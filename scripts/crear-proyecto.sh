#!/usr/bin/env bash
# Crea un proyecto nuevo desde la plantilla, con el pipeline DevSecOps configurado.
# Lo ejecuta el workflow "Crear proyecto". Es reanudable: omite lo que ya existe.
# Variables requeridas: GH_TOKEN, OWNER, PLANTILLA, NOMBRE, SONAR_ORG, SONAR_TOKEN,
# ANTHROPIC_API_KEY, CHAT_WEBHOOK_URL. Opcional: HISTORIA.
set -euo pipefail

REPO="$OWNER/$NOMBRE"
SONAR_KEY="${OWNER}_${NOMBRE}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

paso() { echo; echo "==> $1"; }
ok() { echo "    [OK] $1"; }
aviso() { echo "::warning::$1"; }

# --- Validaciones -----------------------------------------------------------
paso "Validando datos de entrada"
if [[ ! "$NOMBRE" =~ ^[a-z0-9][a-z0-9-]{2,60}$ ]]; then
  echo "::error::Nombre inválido: usa minúsculas, números y guiones (3 a 61 caracteres)."
  exit 1
fi
for v in GH_TOKEN SONAR_TOKEN ANTHROPIC_API_KEY CHAT_WEBHOOK_URL; do
  if [[ -z "${!v:-}" ]]; then echo "::error::Falta el secreto $v en el repositorio plantilla."; exit 1; fi
done
ok "Nombre $NOMBRE y secretos disponibles"

# --- Repositorio ------------------------------------------------------------
paso "Creando el repositorio $REPO desde la plantilla"
gh repo edit "$PLANTILLA" --template >/dev/null
if gh repo view "$REPO" >/dev/null 2>&1; then
  ok "El repositorio ya existe; se continúa con la configuración"
else
  gh repo create "$REPO" --public --template "$PLANTILLA" --description "Proyecto con pipeline DevSecOps e IA"
fi
for _ in $(seq 1 45); do
  if gh api "repos/$REPO/branches/main" --silent >/dev/null 2>&1; then break; fi
  sleep 2
done
gh api "repos/$REPO/branches/main" --silent >/dev/null
ok "Repositorio listo: https://github.com/$REPO"

# --- Secretos, etiquetas y ambientes ----------------------------------------
paso "Configurando secretos, etiquetas y ambientes"
gh secret set ANTHROPIC_API_KEY --repo "$REPO" --body "$ANTHROPIC_API_KEY"
gh secret set SONAR_TOKEN --repo "$REPO" --body "$SONAR_TOKEN"
gh secret set CHAT_WEBHOOK_URL --repo "$REPO" --body "$CHAT_WEBHOOK_URL"
gh label create claude-dev --repo "$REPO" --color 0E8A16 --description "Historia lista para desarrollo con IA" --force
gh label create needs-human --repo "$REPO" --color D93F0B --description "Requiere revisión humana" --force
gh api -X PUT "repos/$REPO/environments/dev" --silent
gh api -X PUT "repos/$REPO/environments/qa" --silent
ok "Secretos, etiquetas y ambientes dev y qa"

# --- SonarQube Cloud --------------------------------------------------------
paso "Configurando el proyecto $SONAR_KEY en SonarQube Cloud"
sonar() { curl -sS -o /tmp/sonar.json -w '%{http_code}' -X POST -H "Authorization: Bearer $SONAR_TOKEN" "$@"; }
codigo=$(sonar --data-urlencode "organization=$SONAR_ORG" --data-urlencode "project=$SONAR_KEY" \
  --data-urlencode "name=$NOMBRE" --data-urlencode "visibility=public" https://sonarcloud.io/api/projects/create)
if [[ "$codigo" == "200" ]]; then
  ok "Proyecto creado"
elif grep -qiE 'already exists|similar key' /tmp/sonar.json; then
  ok "El proyecto ya existe en SonarQube Cloud"
else
  echo "::error::SonarQube Cloud rechazó la creación del proyecto ($codigo): $(cat /tmp/sonar.json)"
  exit 1
fi
if [[ "$(sonar --data-urlencode "project=$SONAR_KEY" --data-urlencode "name=main" https://sonarcloud.io/api/project_branches/rename)" =~ ^2 ]]; then
  ok "Rama principal configurada como main"
else
  aviso "No se pudo renombrar la rama principal en SonarQube: $(cat /tmp/sonar.json)"
fi
if [[ "$(sonar --data-urlencode "projectKey=$SONAR_KEY" --data-urlencode "enable=false" https://sonarcloud.io/api/autoscan/activation)" =~ ^2 ]]; then
  ok "Análisis automático desactivado (el análisis lo hace el pipeline)"
else
  aviso "No se pudo desactivar el análisis automático de SonarQube; hazlo en Administration > Analysis Method."
fi

# --- Configuración de Sonar en el repo --------------------------------------
paso "Ajustando sonar-project.properties"
rm -rf /tmp/nuevo
git clone --quiet --depth 1 "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git" /tmp/nuevo
sed -i -E \
  -e "s/^sonar\.organization=.*/sonar.organization=${SONAR_ORG}/" \
  -e "s/^sonar\.projectKey=.*/sonar.projectKey=${SONAR_KEY}/" \
  -e "s/^sonar\.projectName=.*/sonar.projectName=${NOMBRE}/" \
  /tmp/nuevo/sonar-project.properties
if git -C /tmp/nuevo diff --quiet; then
  ok "La configuración ya estaba aplicada"
else
  git -C /tmp/nuevo -c user.name="plataforma-bot" -c user.email="plataforma-bot@users.noreply.github.com" \
    commit --quiet -am "Configurar SonarQube para $NOMBRE"
  git -C /tmp/nuevo push --quiet
  ok "Configuración subida a main (esto dispara el primer pipeline)"
fi
rm -rf /tmp/nuevo

# --- Ruleset ----------------------------------------------------------------
paso "Protegiendo main con los quality gates obligatorios"
if gh api "repos/$REPO/rulesets" --jq '.[].name' | grep -qx 'Proteger main'; then
  ok "El ruleset Proteger main ya existe"
else
  gh api -X POST "repos/$REPO/rulesets" --input .github/plataforma/ruleset-main.json --silent
  ok "Ruleset activo con 10 quality gates obligatorios"
fi

# --- Historia inicial -------------------------------------------------------
ISSUE_URL=""
if [[ -n "${HISTORIA:-}" && "$HISTORIA" != "ninguna" ]]; then
  paso "Enviando la historia inicial a la IA"
  archivo="historias/${HISTORIA}.md"
  titulo=$(head -n 1 "$archivo" | sed -E 's/^#[[:space:]]*//')
  tail -n +3 "$archivo" > /tmp/historia.md
  ISSUE_URL=$(gh issue create --repo "$REPO" --title "$titulo" --body-file /tmp/historia.md)
  # La etiqueta se agrega aparte para que el evento "labeled" dispare Claude Dev.
  gh issue edit "$ISSUE_URL" --add-label claude-dev >/dev/null
  ok "Historia creada y enviada: $ISSUE_URL"
fi

# --- Resumen ----------------------------------------------------------------
{
  echo "## Proyecto creado: \`$NOMBRE\`"
  echo
  echo "| Recurso | Enlace |"
  echo "| --- | --- |"
  echo "| Repositorio | https://github.com/$REPO |"
  echo "| Pipeline | https://github.com/$REPO/actions |"
  echo "| SonarQube | https://sonarcloud.io/project/overview?id=$SONAR_KEY |"
  if [[ -n "$ISSUE_URL" ]]; then echo "| Historia en desarrollo | $ISSUE_URL |"; fi
  echo
  echo "Configurado: secretos, etiquetas, ambientes \`dev\` y \`qa\`, proyecto en SonarQube y ruleset con 10 quality gates obligatorios."
  echo
  echo "Para enviar nuevas historias: en el repositorio, **Issues → New issue → Historia de usuario**."
} >> "$SUMMARY"
echo; echo "Proyecto listo: https://github.com/$REPO"

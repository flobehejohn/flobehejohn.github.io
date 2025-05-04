// Vérifie si l'objet oxyThemeData existe déjà, sinon le crée pour éviter les erreurs
var oxyThemeData = oxyThemeData || {};

/**
 * 📌 Configuration du menu avec effet de survol (hover)
 *
 * - `hoverActive: false` → Indique si le menu en hover est activé ou non
 * - Cette configuration peut être utilisée ailleurs dans le projet
 *   pour activer/désactiver dynamiquement l'effet hover du menu.
 */
oxyThemeData.hoverMenu = {
  hoverActive: false,
};

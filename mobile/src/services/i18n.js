import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@openride_language';

/**
 * Translation dictionaries for supported languages.
 */
const translations = {
  en: {
    // Common UI
    'common.home': 'Home',
    'common.settings': 'Settings',
    'common.profile': 'Profile',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.save': 'Save',
    'common.done': 'Done',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.retry': 'Retry',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.close': 'Close',
    'common.submit': 'Submit',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.share': 'Share',
    'common.copy': 'Copy',

    // Navigation tabs
    'nav.home': 'Home',
    'nav.activity': 'Activity',
    'nav.governance': 'Governance',
    'nav.profile': 'Profile',
    'nav.dashboard': 'Dashboard',
    'nav.earnings': 'Earnings',

    // Ride statuses
    'ride.status.requested': 'Requested',
    'ride.status.matching': 'Finding Driver',
    'ride.status.accepted': 'Driver Accepted',
    'ride.status.arriving': 'Driver Arriving',
    'ride.status.arrived': 'Driver Arrived',
    'ride.status.in_progress': 'In Progress',
    'ride.status.completed': 'Completed',
    'ride.status.cancelled': 'Cancelled',
    'ride.status.no_drivers': 'No Drivers Available',
    'ride.status.scheduled': 'Scheduled',

    // Ride actions
    'ride.request': 'Request Ride',
    'ride.cancel': 'Cancel Ride',
    'ride.rate': 'Rate Your Ride',
    'ride.schedule': 'Schedule Ride',
    'ride.share': 'Share Ride',
    'ride.track': 'Track Ride',
    'ride.history': 'Ride History',
    'ride.estimatedFare': 'Estimated Fare',
    'ride.whereTo': 'Where to?',
    'ride.pickup': 'Pickup',
    'ride.dropoff': 'Dropoff',
    'ride.findingDriver': 'Finding your driver...',
    'ride.findingDriverSubtext': 'This usually takes less than a minute',

    // Chat
    'chat.title': 'Chat',
    'chat.placeholder': 'Type a message...',
    'chat.noMessages': 'No messages yet',
    'chat.sendMessagePrompt': 'Send a message to start the conversation',
    'chat.typing': 'Typing...',

    // Referrals
    'referral.title': 'Referrals',
    'referral.yourCode': 'Your Referral Code',
    'referral.shareMessage': 'Share this code with friends and earn rewards',
    'referral.totalReferred': 'Total Referred',
    'referral.qualified': 'Qualified',
    'referral.totalEarned': 'Total Earned',
    'referral.noReferrals': 'No referrals yet',

    // Shared rides
    'sharedRide.title': 'Shared Ride',
    'sharedRide.findRides': 'Find Rides',
    'sharedRide.joinRide': 'Join Ride',
    'sharedRide.leaveRide': 'Leave Ride',
    'sharedRide.requestNew': 'Request New',
    'sharedRide.seatsAvailable': '{{count}} seats available',
    'sharedRide.savings': 'You save {{amount}}',

    // Scheduling
    'schedule.title': 'Schedule Ride',
    'schedule.date': 'Date',
    'schedule.time': 'Time',
    'schedule.upcoming': 'Upcoming Scheduled Rides',
    'schedule.noUpcoming': 'No upcoming scheduled rides',

    // Error messages
    'error.generic': 'Something went wrong. Please try again.',
    'error.network': 'Network error. Please check your connection.',
    'error.unauthorized': 'Session expired. Please log in again.',
    'error.notFound': 'The requested resource was not found.',
    'error.server': 'Server error. Please try again later.',
    'error.invalidInput': 'Please check your input and try again.',
    'error.rideFailed': 'Failed to request ride.',
    'error.cancelFailed': 'Failed to cancel ride.',
    'error.loadFailed': 'Failed to load data.',

    // Auth
    'auth.login': 'Log In',
    'auth.register': 'Register',
    'auth.logout': 'Log Out',
    'auth.logoutConfirm': 'Are you sure you want to log out?',
    'auth.email': 'Email',
    'auth.password': 'Password',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Privacy',
    'settings.about': 'About',
  },

  es: {
    // Common UI
    'common.home': 'Inicio',
    'common.settings': 'Configuraci\u00f3n',
    'common.profile': 'Perfil',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.back': 'Atr\u00e1s',
    'common.save': 'Guardar',
    'common.done': 'Hecho',
    'common.edit': 'Editar',
    'common.delete': 'Eliminar',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.retry': 'Reintentar',
    'common.yes': 'S\u00ed',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.close': 'Cerrar',
    'common.submit': 'Enviar',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.share': 'Compartir',
    'common.copy': 'Copiar',

    // Navigation tabs
    'nav.home': 'Inicio',
    'nav.activity': 'Actividad',
    'nav.governance': 'Gobernanza',
    'nav.profile': 'Perfil',
    'nav.dashboard': 'Panel',
    'nav.earnings': 'Ganancias',

    // Ride statuses
    'ride.status.requested': 'Solicitado',
    'ride.status.matching': 'Buscando conductor',
    'ride.status.accepted': 'Conductor aceptado',
    'ride.status.arriving': 'Conductor en camino',
    'ride.status.arrived': 'Conductor lleg\u00f3',
    'ride.status.in_progress': 'En progreso',
    'ride.status.completed': 'Completado',
    'ride.status.cancelled': 'Cancelado',
    'ride.status.no_drivers': 'Sin conductores disponibles',
    'ride.status.scheduled': 'Programado',

    // Ride actions
    'ride.request': 'Solicitar viaje',
    'ride.cancel': 'Cancelar viaje',
    'ride.rate': 'Calificar tu viaje',
    'ride.schedule': 'Programar viaje',
    'ride.share': 'Compartir viaje',
    'ride.track': 'Seguir viaje',
    'ride.history': 'Historial de viajes',
    'ride.estimatedFare': 'Tarifa estimada',
    'ride.whereTo': '\u00bfA d\u00f3nde?',
    'ride.pickup': 'Recogida',
    'ride.dropoff': 'Destino',
    'ride.findingDriver': 'Buscando tu conductor...',
    'ride.findingDriverSubtext': 'Esto generalmente toma menos de un minuto',

    // Chat
    'chat.title': 'Chat',
    'chat.placeholder': 'Escribe un mensaje...',
    'chat.noMessages': 'No hay mensajes a\u00fan',
    'chat.sendMessagePrompt': 'Env\u00eda un mensaje para iniciar la conversaci\u00f3n',
    'chat.typing': 'Escribiendo...',

    // Referrals
    'referral.title': 'Referidos',
    'referral.yourCode': 'Tu c\u00f3digo de referido',
    'referral.shareMessage': 'Comparte este c\u00f3digo con amigos y gana recompensas',
    'referral.totalReferred': 'Total referidos',
    'referral.qualified': 'Calificados',
    'referral.totalEarned': 'Total ganado',
    'referral.noReferrals': 'Sin referidos a\u00fan',

    // Shared rides
    'sharedRide.title': 'Viaje compartido',
    'sharedRide.findRides': 'Buscar viajes',
    'sharedRide.joinRide': 'Unirse al viaje',
    'sharedRide.leaveRide': 'Salir del viaje',
    'sharedRide.requestNew': 'Solicitar nuevo',
    'sharedRide.seatsAvailable': '{{count}} asientos disponibles',
    'sharedRide.savings': 'Ahorras {{amount}}',

    // Scheduling
    'schedule.title': 'Programar viaje',
    'schedule.date': 'Fecha',
    'schedule.time': 'Hora',
    'schedule.upcoming': 'Pr\u00f3ximos viajes programados',
    'schedule.noUpcoming': 'Sin viajes programados',

    // Error messages
    'error.generic': 'Algo sali\u00f3 mal. Por favor, int\u00e9ntalo de nuevo.',
    'error.network': 'Error de red. Verifica tu conexi\u00f3n.',
    'error.unauthorized': 'Sesi\u00f3n expirada. Inicia sesi\u00f3n de nuevo.',
    'error.notFound': 'El recurso solicitado no fue encontrado.',
    'error.server': 'Error del servidor. Int\u00e9ntalo m\u00e1s tarde.',
    'error.invalidInput': 'Verifica tu entrada e int\u00e9ntalo de nuevo.',
    'error.rideFailed': 'Error al solicitar el viaje.',
    'error.cancelFailed': 'Error al cancelar el viaje.',
    'error.loadFailed': 'Error al cargar los datos.',

    // Auth
    'auth.login': 'Iniciar sesi\u00f3n',
    'auth.register': 'Registrarse',
    'auth.logout': 'Cerrar sesi\u00f3n',
    'auth.logoutConfirm': '\u00bfEst\u00e1s seguro de que quieres cerrar sesi\u00f3n?',
    'auth.email': 'Correo electr\u00f3nico',
    'auth.password': 'Contrase\u00f1a',

    // Settings
    'settings.title': 'Configuraci\u00f3n',
    'settings.language': 'Idioma',
    'settings.notifications': 'Notificaciones',
    'settings.privacy': 'Privacidad',
    'settings.about': 'Acerca de',
  },

  fr: {
    // Common UI
    'common.home': 'Accueil',
    'common.settings': 'Param\u00e8tres',
    'common.profile': 'Profil',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.back': 'Retour',
    'common.save': 'Enregistrer',
    'common.done': 'Termin\u00e9',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.search': 'Rechercher',
    'common.loading': 'Chargement...',
    'common.retry': 'R\u00e9essayer',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.ok': 'OK',
    'common.close': 'Fermer',
    'common.submit': 'Soumettre',
    'common.next': 'Suivant',
    'common.previous': 'Pr\u00e9c\u00e9dent',
    'common.share': 'Partager',
    'common.copy': 'Copier',

    // Navigation tabs
    'nav.home': 'Accueil',
    'nav.activity': 'Activit\u00e9',
    'nav.governance': 'Gouvernance',
    'nav.profile': 'Profil',
    'nav.dashboard': 'Tableau de bord',
    'nav.earnings': 'Revenus',

    // Ride statuses
    'ride.status.requested': 'Demand\u00e9',
    'ride.status.matching': 'Recherche de chauffeur',
    'ride.status.accepted': 'Chauffeur accept\u00e9',
    'ride.status.arriving': 'Chauffeur en route',
    'ride.status.arrived': 'Chauffeur arriv\u00e9',
    'ride.status.in_progress': 'En cours',
    'ride.status.completed': 'Termin\u00e9',
    'ride.status.cancelled': 'Annul\u00e9',
    'ride.status.no_drivers': 'Aucun chauffeur disponible',
    'ride.status.scheduled': 'Programm\u00e9',

    // Ride actions
    'ride.request': 'Demander un trajet',
    'ride.cancel': 'Annuler le trajet',
    'ride.rate': '\u00c9valuer votre trajet',
    'ride.schedule': 'Programmer un trajet',
    'ride.share': 'Partager le trajet',
    'ride.track': 'Suivre le trajet',
    'ride.history': 'Historique des trajets',
    'ride.estimatedFare': 'Tarif estim\u00e9',
    'ride.whereTo': 'O\u00f9 allez-vous ?',
    'ride.pickup': 'D\u00e9part',
    'ride.dropoff': 'Arriv\u00e9e',
    'ride.findingDriver': 'Recherche de votre chauffeur...',
    'ride.findingDriverSubtext': 'Cela prend g\u00e9n\u00e9ralement moins d\u2019une minute',

    // Chat
    'chat.title': 'Discussion',
    'chat.placeholder': '\u00c9crivez un message...',
    'chat.noMessages': 'Pas encore de messages',
    'chat.sendMessagePrompt': 'Envoyez un message pour commencer la conversation',
    'chat.typing': 'En train d\u2019\u00e9crire...',

    // Referrals
    'referral.title': 'Parrainages',
    'referral.yourCode': 'Votre code de parrainage',
    'referral.shareMessage': 'Partagez ce code avec vos amis et gagnez des r\u00e9compenses',
    'referral.totalReferred': 'Total parrain\u00e9s',
    'referral.qualified': 'Qualifi\u00e9s',
    'referral.totalEarned': 'Total gagn\u00e9',
    'referral.noReferrals': 'Pas encore de parrainages',

    // Shared rides
    'sharedRide.title': 'Trajet partag\u00e9',
    'sharedRide.findRides': 'Chercher des trajets',
    'sharedRide.joinRide': 'Rejoindre le trajet',
    'sharedRide.leaveRide': 'Quitter le trajet',
    'sharedRide.requestNew': 'Nouvelle demande',
    'sharedRide.seatsAvailable': '{{count}} places disponibles',
    'sharedRide.savings': 'Vous \u00e9conomisez {{amount}}',

    // Scheduling
    'schedule.title': 'Programmer un trajet',
    'schedule.date': 'Date',
    'schedule.time': 'Heure',
    'schedule.upcoming': 'Prochains trajets programm\u00e9s',
    'schedule.noUpcoming': 'Aucun trajet programm\u00e9',

    // Error messages
    'error.generic': 'Une erreur est survenue. Veuillez r\u00e9essayer.',
    'error.network': 'Erreur r\u00e9seau. V\u00e9rifiez votre connexion.',
    'error.unauthorized': 'Session expir\u00e9e. Veuillez vous reconnecter.',
    'error.notFound': 'La ressource demand\u00e9e est introuvable.',
    'error.server': 'Erreur serveur. Veuillez r\u00e9essayer plus tard.',
    'error.invalidInput': 'V\u00e9rifiez votre saisie et r\u00e9essayez.',
    'error.rideFailed': '\u00c9chec de la demande de trajet.',
    'error.cancelFailed': '\u00c9chec de l\u2019annulation du trajet.',
    'error.loadFailed': '\u00c9chec du chargement des donn\u00e9es.',

    // Auth
    'auth.login': 'Se connecter',
    'auth.register': 'S\u2019inscrire',
    'auth.logout': 'Se d\u00e9connecter',
    'auth.logoutConfirm': '\u00cates-vous s\u00fbr de vouloir vous d\u00e9connecter ?',
    'auth.email': 'E-mail',
    'auth.password': 'Mot de passe',

    // Settings
    'settings.title': 'Param\u00e8tres',
    'settings.language': 'Langue',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Confidentialit\u00e9',
    'settings.about': '\u00c0 propos',
  },
};

/**
 * Supported languages metadata.
 */
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais' },
];

/**
 * Current language state (defaults to English).
 */
let currentLanguage = 'en';
let initialized = false;

/**
 * Initialize the i18n service by loading the persisted language preference.
 * Call this once at app startup.
 * @returns {Promise<string>} The loaded language code.
 */
export const initI18n = async () => {
  if (initialized) return currentLanguage;

  try {
    const storedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLang && translations[storedLang]) {
      currentLanguage = storedLang;
    }
  } catch (error) {
    console.warn('[i18n] Failed to load language preference:', error.message);
  }

  initialized = true;
  return currentLanguage;
};

/**
 * Translate a key with optional parameter interpolation.
 *
 * Parameters in the translation string use `{{paramName}}` syntax.
 *
 * @param {string} key - The translation key (e.g. "common.cancel").
 * @param {object} [params] - Optional key-value pairs for interpolation.
 * @returns {string} The translated string, or the key itself if not found.
 *
 * @example
 * t('common.cancel')                    // => "Cancel"
 * t('sharedRide.savings', { amount: '$5.00' }) // => "You save $5.00"
 */
export const t = (key, params = {}) => {
  const dict = translations[currentLanguage] || translations.en;
  let value = dict[key];

  // Fallback to English if key not found in current language
  if (value === undefined) {
    value = translations.en[key];
  }

  // Return the key itself if still not found
  if (value === undefined) {
    return key;
  }

  // Interpolate parameters
  if (params && typeof params === 'object') {
    Object.keys(params).forEach((paramKey) => {
      const regex = new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g');
      value = value.replace(regex, String(params[paramKey]));
    });
  }

  return value;
};

/**
 * Set the active language and persist the preference.
 * @param {string} lang - Language code (e.g. "en", "es", "fr").
 * @returns {Promise<void>}
 */
export const setLanguage = async (lang) => {
  if (!translations[lang]) {
    console.warn(`[i18n] Unsupported language: ${lang}`);
    return;
  }

  currentLanguage = lang;

  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.warn('[i18n] Failed to persist language preference:', error.message);
  }
};

/**
 * Get the currently active language code.
 * @returns {string} The current language code.
 */
export const getLanguage = () => {
  return currentLanguage;
};

/**
 * Get the list of supported languages.
 * @returns {Array<{ code: string, name: string, nativeName: string }>}
 */
export const getSupportedLanguages = () => {
  return [...SUPPORTED_LANGUAGES];
};

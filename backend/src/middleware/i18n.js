/**
 * Internationalisation (i18n) middleware and translation utilities.
 *
 * Resolves the user's preferred language from:
 *   1. `?lang=` query parameter (highest priority)
 *   2. `Accept-Language` HTTP header
 *   3. Default: 'en'
 *
 * Sets `req.language` so downstream handlers can use it.
 */

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

export const supportedLanguages = [
  'en', // English
  'es', // Spanish
  'fr', // French
  'de', // German
  'pt', // Portuguese
  'zh', // Chinese (Simplified)
  'ar', // Arabic
  'hi', // Hindi
  'ja', // Japanese
  'ko', // Korean
];

const supportedSet = new Set(supportedLanguages);

// ---------------------------------------------------------------------------
// Translation strings
// ---------------------------------------------------------------------------

const translations = {
  // -- Generic errors -------------------------------------------------------
  'error.internal': {
    en: 'Internal server error',
    es: 'Error interno del servidor',
    fr: 'Erreur interne du serveur',
    de: 'Interner Serverfehler',
    pt: 'Erro interno do servidor',
    zh: '内部服务器错误',
    ar: 'خطأ داخلي في الخادم',
    hi: 'आंतरिक सर्वर त्रुटि',
    ja: 'サーバー内部エラー',
    ko: '내부 서버 오류',
  },
  'error.not_found': {
    en: 'The requested resource was not found',
    es: 'El recurso solicitado no fue encontrado',
    fr: 'La ressource demandée est introuvable',
    de: 'Die angeforderte Ressource wurde nicht gefunden',
    pt: 'O recurso solicitado não foi encontrado',
    zh: '请求的资源未找到',
    ar: 'لم يتم العثور على المورد المطلوب',
    hi: 'अनुरोधित संसाधन नहीं मिला',
    ja: 'リクエストされたリソースが見つかりません',
    ko: '요청한 리소스를 찾을 수 없습니다',
  },
  'error.unauthorized': {
    en: 'Authentication required',
    es: 'Se requiere autenticación',
    fr: 'Authentification requise',
    de: 'Authentifizierung erforderlich',
    pt: 'Autenticação necessária',
    zh: '需要身份验证',
    ar: 'المصادقة مطلوبة',
    hi: 'प्रमाणीकरण आवश्यक',
    ja: '認証が必要です',
    ko: '인증이 필요합니다',
  },
  'error.forbidden': {
    en: 'You do not have permission to perform this action',
    es: 'No tienes permiso para realizar esta acción',
    fr: "Vous n'avez pas la permission d'effectuer cette action",
    de: 'Sie haben keine Berechtigung, diese Aktion auszuführen',
    pt: 'Você não tem permissão para realizar esta ação',
    zh: '您没有权限执行此操作',
    ar: 'ليس لديك إذن لتنفيذ هذا الإجراء',
    hi: 'आपको यह कार्रवाई करने की अनुमति नहीं है',
    ja: 'このアクションを実行する権限がありません',
    ko: '이 작업을 수행할 권한이 없습니다',
  },
  'error.validation': {
    en: 'Validation failed',
    es: 'La validación falló',
    fr: 'La validation a échoué',
    de: 'Validierung fehlgeschlagen',
    pt: 'A validação falhou',
    zh: '验证失败',
    ar: 'فشل التحقق',
    hi: 'सत्यापन विफल',
    ja: 'バリデーションに失敗しました',
    ko: '유효성 검사에 실패했습니다',
  },

  // -- Success messages -----------------------------------------------------
  'success.created': {
    en: 'Resource created successfully',
    es: 'Recurso creado exitosamente',
    fr: 'Ressource créée avec succès',
    de: 'Ressource erfolgreich erstellt',
    pt: 'Recurso criado com sucesso',
    zh: '资源创建成功',
    ar: 'تم إنشاء المورد بنجاح',
    hi: 'संसाधन सफलतापूर्वक बनाया गया',
    ja: 'リソースが正常に作成されました',
    ko: '리소스가 성공적으로 생성되었습니다',
  },
  'success.updated': {
    en: 'Updated successfully',
    es: 'Actualizado exitosamente',
    fr: 'Mis à jour avec succès',
    de: 'Erfolgreich aktualisiert',
    pt: 'Atualizado com sucesso',
    zh: '更新成功',
    ar: 'تم التحديث بنجاح',
    hi: 'सफलतापूर्वक अपडेट किया गया',
    ja: '正常に更新されました',
    ko: '성공적으로 업데이트되었습니다',
  },
  'success.deleted': {
    en: 'Deleted successfully',
    es: 'Eliminado exitosamente',
    fr: 'Supprimé avec succès',
    de: 'Erfolgreich gelöscht',
    pt: 'Excluído com sucesso',
    zh: '删除成功',
    ar: 'تم الحذف بنجاح',
    hi: 'सफलतापूर्वक हटाया गया',
    ja: '正常に削除されました',
    ko: '성공적으로 삭제되었습니다',
  },

  // -- Ride statuses --------------------------------------------------------
  'ride.status.requested': {
    en: 'Ride requested',
    es: 'Viaje solicitado',
    fr: 'Course demandée',
    de: 'Fahrt angefragt',
    pt: 'Corrida solicitada',
    zh: '已请求行程',
    ar: 'تم طلب الرحلة',
    hi: 'सवारी का अनुरोध किया गया',
    ja: '配車リクエスト済み',
    ko: '탑승 요청됨',
  },
  'ride.status.matched': {
    en: 'Driver matched',
    es: 'Conductor asignado',
    fr: 'Chauffeur trouvé',
    de: 'Fahrer zugewiesen',
    pt: 'Motorista encontrado',
    zh: '已匹配司机',
    ar: 'تم مطابقة السائق',
    hi: 'ड्राइवर मिला',
    ja: 'ドライバーがマッチしました',
    ko: '드라이버 매칭됨',
  },
  'ride.status.driver_arriving': {
    en: 'Driver is on the way',
    es: 'El conductor está en camino',
    fr: 'Le chauffeur est en route',
    de: 'Fahrer ist unterwegs',
    pt: 'Motorista a caminho',
    zh: '司机正在赶来',
    ar: 'السائق في الطريق',
    hi: 'ड्राइवर रास्ते में है',
    ja: 'ドライバーが向かっています',
    ko: '드라이버가 오고 있습니다',
  },
  'ride.status.in_progress': {
    en: 'Ride in progress',
    es: 'Viaje en curso',
    fr: 'Course en cours',
    de: 'Fahrt läuft',
    pt: 'Corrida em andamento',
    zh: '行程进行中',
    ar: 'الرحلة قيد التنفيذ',
    hi: 'सवारी जारी है',
    ja: '乗車中',
    ko: '탑승 진행 중',
  },
  'ride.status.completed': {
    en: 'Ride completed',
    es: 'Viaje completado',
    fr: 'Course terminée',
    de: 'Fahrt abgeschlossen',
    pt: 'Corrida concluída',
    zh: '行程已完成',
    ar: 'اكتملت الرحلة',
    hi: 'सवारी पूरी हुई',
    ja: '乗車完了',
    ko: '탑승 완료',
  },
  'ride.status.cancelled': {
    en: 'Ride cancelled',
    es: 'Viaje cancelado',
    fr: 'Course annulée',
    de: 'Fahrt storniert',
    pt: 'Corrida cancelada',
    zh: '行程已取消',
    ar: 'تم إلغاء الرحلة',
    hi: 'सवारी रद्द की गई',
    ja: '乗車キャンセル',
    ko: '탑승 취소됨',
  },

  // -- Notification titles --------------------------------------------------
  'notification.ride_matched': {
    en: 'Driver Found',
    es: 'Conductor Encontrado',
    fr: 'Chauffeur Trouvé',
    de: 'Fahrer Gefunden',
    pt: 'Motorista Encontrado',
    zh: '已找到司机',
    ar: 'تم العثور على سائق',
    hi: 'ड्राइवर मिला',
    ja: 'ドライバーが見つかりました',
    ko: '드라이버를 찾았습니다',
  },
  'notification.ride_arriving': {
    en: 'Your driver is arriving',
    es: 'Tu conductor está llegando',
    fr: 'Votre chauffeur arrive',
    de: 'Ihr Fahrer kommt an',
    pt: 'Seu motorista está chegando',
    zh: '司机即将到达',
    ar: 'سائقك يصل',
    hi: 'आपका ड्राइवर आ रहा है',
    ja: 'ドライバーが到着します',
    ko: '드라이버가 도착합니다',
  },
  'notification.ride_completed': {
    en: 'Ride completed. Please rate your experience.',
    es: 'Viaje completado. Por favor califica tu experiencia.',
    fr: 'Course terminée. Veuillez évaluer votre expérience.',
    de: 'Fahrt abgeschlossen. Bitte bewerten Sie Ihre Erfahrung.',
    pt: 'Corrida concluída. Avalie sua experiência.',
    zh: '行程已完成。请为您的体验评分。',
    ar: 'اكتملت الرحلة. يرجى تقييم تجربتك.',
    hi: 'सवारी पूरी हुई। कृपया अपने अनुभव को रेट करें।',
    ja: '乗車完了。体験を評価してください。',
    ko: '탑승 완료. 경험을 평가해 주세요.',
  },
  'notification.payment_received': {
    en: 'Payment received',
    es: 'Pago recibido',
    fr: 'Paiement reçu',
    de: 'Zahlung erhalten',
    pt: 'Pagamento recebido',
    zh: '已收到付款',
    ar: 'تم استلام الدفع',
    hi: 'भुगतान प्राप्त',
    ja: '支払いを受け取りました',
    ko: '결제가 완료되었습니다',
  },
  'notification.new_ride_request': {
    en: 'New ride request nearby',
    es: 'Nueva solicitud de viaje cercana',
    fr: 'Nouvelle demande de course à proximité',
    de: 'Neue Fahrtanfrage in der Nähe',
    pt: 'Nova solicitação de corrida próxima',
    zh: '附近有新的行程请求',
    ar: 'طلب رحلة جديد بالقرب منك',
    hi: 'पास में नई सवारी अनुरोध',
    ja: '近くに新しい配車リクエスト',
    ko: '근처에 새로운 탑승 요청',
  },

  // -- Accessibility --------------------------------------------------------
  'accessibility.preferences_updated': {
    en: 'Accessibility preferences updated',
    es: 'Preferencias de accesibilidad actualizadas',
    fr: "Préférences d'accessibilité mises à jour",
    de: 'Barrierefreiheits-Einstellungen aktualisiert',
    pt: 'Preferências de acessibilidade atualizadas',
    zh: '无障碍偏好已更新',
    ar: 'تم تحديث تفضيلات إمكانية الوصول',
    hi: 'सुलभता प्राथमिकताएं अपडेट की गईं',
    ja: 'アクセシビリティ設定が更新されました',
    ko: '접근성 환경설정이 업데이트되었습니다',
  },
  'accessibility.no_drivers': {
    en: 'No accessible drivers available nearby',
    es: 'No hay conductores accesibles disponibles cerca',
    fr: "Aucun chauffeur accessible disponible à proximité",
    de: 'Keine barrierefreien Fahrer in der Nähe verfügbar',
    pt: 'Nenhum motorista acessível disponível nas proximidades',
    zh: '附近没有无障碍司机可用',
    ar: 'لا يوجد سائقون متاحون لذوي الاحتياجات الخاصة بالقرب منك',
    hi: 'पास में कोई सुलभ ड्राइवर उपलब्ध नहीं है',
    ja: '近くにバリアフリー対応ドライバーがいません',
    ko: '근처에 이용 가능한 접근성 드라이버가 없습니다',
  },
  'accessibility.driver_features_updated': {
    en: 'Driver accessibility features updated',
    es: 'Funciones de accesibilidad del conductor actualizadas',
    fr: "Fonctionnalités d'accessibilité du chauffeur mises à jour",
    de: 'Barrierefreiheits-Funktionen des Fahrers aktualisiert',
    pt: 'Recursos de acessibilidade do motorista atualizados',
    zh: '司机无障碍功能已更新',
    ar: 'تم تحديث ميزات إمكانية الوصول للسائق',
    hi: 'ड्राइवर सुलभता सुविधाएं अपडेट की गईं',
    ja: 'ドライバーのアクセシビリティ機能が更新されました',
    ko: '드라이버 접근성 기능이 업데이트되었습니다',
  },
};

// ---------------------------------------------------------------------------
// t — Translation lookup function
// ---------------------------------------------------------------------------

/**
 * Look up a translation string by key and language.
 *
 * Supports simple parameter interpolation using `{{paramName}}` placeholders.
 *
 * @param {string} key      - Translation key (e.g. 'error.internal')
 * @param {string} [language='en'] - Language code
 * @param {object} [params={}]     - Interpolation parameters
 * @returns {string} The translated string, or the key itself as a fallback
 *
 * @example
 *   t('ride.status.completed', 'es')
 *   // => 'Viaje completado'
 *
 *   t('greeting', 'en', { name: 'Alice' })
 *   // => 'Hello, Alice!' (if the template is 'Hello, {{name}}!')
 */
export function t(key, language = 'en', params = {}) {
  const entry = translations[key];

  if (!entry) {
    // Key not found — return the key itself so it's visible in output
    return key;
  }

  // Fall back to English if the requested language is not available
  let str = entry[language] || entry.en || key;

  // Replace {{paramName}} placeholders
  if (params && typeof params === 'object') {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
    }
  }

  return str;
}

// ---------------------------------------------------------------------------
// i18n middleware
// ---------------------------------------------------------------------------

/**
 * Parse the Accept-Language header and extract language codes with quality values.
 *
 * @param {string} header - The Accept-Language header value
 * @returns {string[]} Array of language codes sorted by quality (highest first)
 */
function parseAcceptLanguage(header) {
  if (!header) {
    return [];
  }

  return header
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      const [lang, qPart] = trimmed.split(';');
      const code = lang.trim().split('-')[0].toLowerCase(); // 'en-US' -> 'en'
      const quality = qPart
        ? parseFloat(qPart.replace(/^\s*q\s*=\s*/, ''))
        : 1.0;
      return { code, quality };
    })
    .filter((entry) => !Number.isNaN(entry.quality) && entry.code.length > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.code);
}

/**
 * Express middleware that resolves the request language.
 *
 * Resolution order:
 *   1. `?lang=xx` query parameter
 *   2. `Accept-Language` header
 *   3. Default: 'en'
 *
 * Sets `req.language` to the resolved language code.
 */
export default function i18nMiddleware(req, _res, next) {
  let resolved = 'en';

  // 1. Check query parameter (highest priority)
  const queryLang = req.query?.lang;
  if (queryLang && typeof queryLang === 'string') {
    const normalised = queryLang.trim().toLowerCase().split('-')[0];
    if (supportedSet.has(normalised)) {
      resolved = normalised;
      req.language = resolved;
      return next();
    }
  }

  // 2. Parse Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    const preferred = parseAcceptLanguage(acceptLanguage);
    for (const code of preferred) {
      if (supportedSet.has(code)) {
        resolved = code;
        break;
      }
    }
  }

  req.language = resolved;
  next();
}

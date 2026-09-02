// translationService.js

export const translateLongText = async (text, onProgress) => {
  if (!text) return '';

  const apiKey = import.meta.env.VITE_DEEPL_API_KEY;

  // Sécurité : si tu as oublié de mettre la clé, ça affiche l'anglais sans faire d'erreur
  if (!apiKey) {
    console.warn("Clé API DeepL (VITE_DEEPL_API_KEY) manquante. Affichage du texte original.");
    if (onProgress) onProgress(100);
    return text;
  }

  try {
    if (onProgress) onProgress(30);

    // Attention : l'URL pour l'API gratuite est api-free.deepl.com
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'FR'
      })
    });

    if (onProgress) onProgress(80);

    if (!response.ok) {
      throw new Error(`Erreur API DeepL : HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (onProgress) onProgress(100);
    
    // On renvoie le texte traduit
    return data.translations[0].text;

  } catch (error) {
    console.error("Échec de la traduction:", error);
    if (onProgress) onProgress(100);
    
    // Fallback : en cas de problème (plus d'internet, limite atteinte), on affiche le texte anglais d'origine
    return text; 
  }
};
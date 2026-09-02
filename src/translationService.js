const translationCache = new Map()

const LIBRETRANSLATE_ENDPOINTS = [
  'https://libretranslate.de/translate',
  'https://libretranslate.com/translate',
  'https://translate.terraprint.co/translate',
  'https://libretranslate.pussthecat.org/translate'
]

const ALT_TRANSLATE_ENDPOINTS = [
  'https://translate.argosopentech.com/translate',
  'https://translate.astian.org/translate'
]

const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx'
const LINGVA_ENDPOINT = 'https://lingva.ml/api/v1/en/fr'
const APERTIUM_ENDPOINT = 'https://api.apertium.org/json/translate'

const splitTextIntoChunks = (text, maxLength = 450) => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length < maxLength) {
      currentChunk += sentence + ' '
    } else {
      chunks.push(currentChunk.trim())
      currentChunk = sentence + ' '
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

const isBadTranslation = (original, translated) => {
  if (!translated) return true
  const trimmedTranslated = translated.trim()
  if (!trimmedTranslated) return true
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|OVER_QUERY_LIMIT|LIMITED/i.test(trimmedTranslated)) {
    return true
  }
  return original.trim().toLowerCase() === trimmedTranslated.toLowerCase()
}

const translateWithLibreTranslate = async (chunk) => {
  for (const endpoint of LIBRETRANSLATE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: chunk,
          source: 'en',
          target: 'fr',
          format: 'text'
        })
      })

      if (!response.ok) continue
      const data = await response.json()
      if (data?.translatedText) {
        return data.translatedText
      }
    } catch (error) {
      continue
    }
  }
  return null
}

const translateWithAlternative = async (chunk) => {
  for (const endpoint of ALT_TRANSLATE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: chunk,
          source: 'en',
          target: 'fr',
          format: 'text'
        })
      })

      if (!response.ok) continue
      const data = await response.json()
      if (data?.translatedText) {
        return data.translatedText
      }
    } catch (error) {
      continue
    }
  }
  return null
}

const translateWithGoogle = async (chunk) => {
  try {
    // On passe de sl=en à sl=auto pour que Google détecte le Chinois/Coréen/Anglais automatiquement
    const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(chunk)}`)
    if (!response.ok) return null
    const data = await response.json()
    if (Array.isArray(data) && data[0]) {
      return data[0].map((segment) => segment[0]).join('')
    }
    return null
  } catch (error) {
    return null
  }
}

const translateWithLingva = async (chunk) => {
  try {
    const response = await fetch(`${LINGVA_ENDPOINT}/${encodeURIComponent(chunk)}`)
    if (!response.ok) return null
    const data = await response.json()
    if (data?.translation) {
      return data.translation
    }
    return null
  } catch (error) {
    return null
  }
}

const translateWithDeepL = async (chunk) => {
  try {
    const apiKey = import.meta.env.VITE_DEEPL_API_KEY
    if (!apiKey) return null

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [chunk],
        target_lang: 'FR'
      })
    })

    if (!response.ok) return null
    const data = await response.json()
    if (data?.translations?.[0]?.text) {
      return data.translations[0].text
    }
    return null
  } catch (error) {
    return null
  }
}

const translateWithApertium = async (chunk) => {
  try {
    const response = await fetch(`${APERTIUM_ENDPOINT}?q=${encodeURIComponent(chunk)}&langpair=en|fr`)
    if (!response.ok) return null
    const data = await response.json()
    const translatedText = data?.responseData?.translatedText || data?.responseData
    if (!translatedText) return null
    return typeof translatedText === 'string' ? translatedText : translatedText.join(' ')
  } catch (error) {
    return null
  }
}

const translateWithMyMemory = async (chunk) => {
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|fr`)
    if (!response.ok) return null
    const data = await response.json()
    const translatedText = data?.responseData?.translatedText
    if (!translatedText || /MYMEMORY WARNING|QUERY LENGTH LIMIT|OVER_QUERY_LIMIT|LIMITED/i.test(translatedText)) {
      return null
    }
    return translatedText
  } catch (error) {
    return null
  }
}

export const translateLongText = async (text, onProgress) => {
  if (!text) return ''
  const cacheKey = text.trim()
  if (translationCache.has(cacheKey)) {
    if (typeof onProgress === 'function') onProgress(100)
    return translationCache.get(cacheKey)
  }

  const chunks = splitTextIntoChunks(text)
  let translated = ''

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    let chunkTranslation = await translateWithLibreTranslate(chunk)

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = await translateWithGoogle(chunk)
    }

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = await translateWithLingva(chunk)
    }

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = await translateWithAlternative(chunk)
    }

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = await translateWithApertium(chunk)
    }

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = await translateWithMyMemory(chunk)
    }

    if (isBadTranslation(chunk, chunkTranslation)) {
      chunkTranslation = chunk
    }

    translated += chunkTranslation + ' '
    if (typeof onProgress === 'function') {
      onProgress(Math.round(((i + 1) / chunks.length) * 100))
    }
  }

  const result = translated.trim()
  translationCache.set(cacheKey, result)
  if (typeof onProgress === 'function') onProgress(100)
  return result
}

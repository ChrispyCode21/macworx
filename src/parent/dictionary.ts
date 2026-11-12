import type { Lookup } from '../engine'

// The packages' own entry points read their files with Node, so the raw Hunspell files are fetched instead. The
// relative paths skip the packages' `exports`. The files are served from this site and are not in the offline files
// (vite.config.ts), so only a parent's browser on the Content screen ever downloads them.
import usAff from '../../node_modules/dictionary-en/index.aff?url&no-inline'
import usDic from '../../node_modules/dictionary-en/index.dic?url&no-inline'
import ukAff from '../../node_modules/dictionary-en-gb/index.aff?url&no-inline'
import ukDic from '../../node_modules/dictionary-en-gb/index.dic?url&no-inline'

export interface Dictionaries {
  us: Lookup
  uk: Lookup
}

const text = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(url)
  return response.text()
}

/** Building a dictionary takes a moment; this lets typing carry on first. */
const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

let loading: Promise<Dictionaries | null> | null = null

/**
 * The US and UK English dictionaries (SPEC §6.11), loaded once and only when asked for. Where they can't load (no
 * connection, a blocked file) it answers null and the next call tries again (the form asks again when the words change);
 * the check is advice, so the page goes on.
 */
export function loadDictionaries(): Promise<Dictionaries | null> {
  loading ??= (async () => {
    const [{ default: nspell }, usFiles, ukFiles] = await Promise.all([
      import('nspell'),
      Promise.all([text(usAff), text(usDic)]),
      Promise.all([text(ukAff), text(ukDic)]),
    ])
    await later()
    const us = nspell(usFiles[0], usFiles[1])
    await later()
    const uk = nspell(ukFiles[0], ukFiles[1])
    return { us, uk }
  })().catch(() => {
    loading = null
    return null
  })
  return loading
}

import { createClient } from '@supabase/supabase-js'

const STORAGE_URL_KEY = 'summer_fonseca_supabase_url'
const STORAGE_ANON_KEY = 'summer_fonseca_supabase_anon_key'

let supabaseClient = null

export function getSavedSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const localUrl = localStorage.getItem(STORAGE_URL_KEY) || ''
  const localKey = localStorage.getItem(STORAGE_ANON_KEY) || ''

  return {
    url: (localUrl || envUrl).trim(),
    anonKey: (localKey || envKey).trim(),
  }
}

export function saveSupabaseConfig(url, anonKey) {
  const cleanUrl = (url || '').trim()
  const cleanKey = (anonKey || '').trim()

  if (cleanUrl && cleanKey) {
    localStorage.setItem(STORAGE_URL_KEY, cleanUrl)
    localStorage.setItem(STORAGE_ANON_KEY, cleanKey)
  } else {
    localStorage.removeItem(STORAGE_URL_KEY)
    localStorage.removeItem(STORAGE_ANON_KEY)
  }
  supabaseClient = null
  return getSupabaseClient()
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  const { url, anonKey } = getSavedSupabaseConfig()
  if (!url || !anonKey) return null

  try {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
    return supabaseClient
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err)
    return null
  }
}

/**
 * Valida o JWT diretamente no servidor Auth do Supabase via getUser()
 * (nunca confia apenas em getSession() local).
 */
export async function getAuthenticatedSupabaseUser() {
  const client = getSupabaseClient()
  if (!client) return null
  try {
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

export async function signInSupabaseWithPassword(email, password) {
  const client = getSupabaseClient()
  if (!client) {
    return { user: null, error: 'Configure a URL e a Publishable Key do projeto primeiro.' }
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: (email || '').trim(),
    password: password || '',
  })
  if (error) {
    return { user: null, error: error.message }
  }
  return { user: data?.user || null, error: null }
}

export async function signOutSupabase() {
  const client = getSupabaseClient()
  if (!client) return
  await client.auth.signOut()
}

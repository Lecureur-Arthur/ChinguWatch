import { createClient } from '@supabase/supabase-js'

// Je récupère les variables d'environnement configurées dans mon fichier local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// J'initialise et j'exporte l'instance du client Supabase pour pouvoir interagir avec ma base de données
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
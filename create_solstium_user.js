
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bvmwnxargzlfheiwyget.supabase.co'
const supabaseKey = 'sb_publishable_JZUOFsqpHv9QqltRPwQnew_S2ch4yNY' // From your .env
const supabase = createClient(supabaseUrl, supabaseKey)

const email = 'agency@solstium.com'
const password = 'SolstiumAgency2026!'

async function createAgencyUser() {
    console.log(`Creating user: ${email}...`)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Solstium Agency',
            }
        }
    })

    if (error) {
        console.error('Error creating user:', error.message)
        return
    }

    if (data.user) {
        console.log('--------------------------------------------------')
        console.log('✅ User created successfully!')
        console.log(`Email: ${email}`)
        console.log(`Password: ${password}`)
        console.log(`User ID: ${data.user.id}`)
        console.log('--------------------------------------------------')
        console.log('⚠️ IMPORTANT: To enable Agency features, you MUST run this SQL command in Supabase SQL Editor:')
        console.log('\n')
        console.log(`UPDATE profiles SET role = 'agency' WHERE id = '${data.user.id}';`)
        console.log(`INSERT INTO agency_brands (agency_user_id, client_id) SELECT '${data.user.id}', id FROM clients WHERE brand_name ILIKE '%Solstium%' ON CONFLICT DO NOTHING;`)
        console.log('\n')
    } else {
        console.log('User created but no data returned. Check email confirmation settings.')
    }
}

createAgencyUser()

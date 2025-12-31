# Ludoteca + Supabase (CRUD real, sen localStorage)
1) Pega en `config.js` o **Project URL** e a **anon public key** (Supabase → Project Settings → API).
2) En Supabase → SQL Editor, executa `supabase/schema.sql`.
3) Marca o teu usuario como admin:
```sql
update public.profiles set is_admin = true where email = 'TEU_EMAIL';
```
4) Na web: 👤 login → 📌 modo edición → “Importar JSON” e escolle `seed/games.json`.

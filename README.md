# Ludoteca — estética bonita + portada BGG + imaxes extra na ficha

## Datos
Edita `data/games.json`.

Para imaxes externas (non ocupan repo):
```json
"images":{
  "cover":"https://…/cover.jpg",
  "gallery":[ "https://…/img1.jpg", "https://…/img2.jpg" ]
}
```

Se `images.cover` está baleiro e tes `bggId`, a portada cárgase desde BGG (caché en localStorage).

## Vercel/GitHub
Sube todo á raíz do repo mantendo a carpeta `data/`.

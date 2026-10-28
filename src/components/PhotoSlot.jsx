import React, { useState } from 'react'

// Emplacement photo : hachuré avec légende tant que le fichier n'existe pas
// dans public/photos/ ; remplacé par la vraie image dès qu'elle est en ligne.
// src : chemin sous /photos/ (ex. « carnet.jpg »).
export default function PhotoSlot({ src, legende = 'Photo à venir', alt = '' }) {
  const [chargee, setChargee] = useState(false)
  const [absente, setAbsente] = useState(!src)
  return (
    <div className={`ph ${chargee ? 'ph-img' : ''}`}>
      {!absente && src && (
        <img
          src={`/photos/${src}`}
          alt={alt}
          loading="lazy"
          style={chargee ? undefined : { display: 'none' }}
          onLoad={() => setChargee(true)}
          onError={() => setAbsente(true)}
        />
      )}
      {!chargee && <span>{legende}</span>}
    </div>
  )
}

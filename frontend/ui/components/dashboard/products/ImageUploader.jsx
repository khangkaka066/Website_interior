'use client'

import { useRef, useState, useEffect } from 'react'

const PRESET_IMAGES = [
  '/images/curtains/blue.webp',
  '/images/curtains/black.webp',
  '/images/curtains/brown.webp',
  '/images/curtains/silver.webp',
  '/images/curtains/purple-gray.webp',
  '/images/curtains/gold.webp',
  '/images/curtains/pillow.webp',
  '/images/curtains/collage-dan-tuong.webp',
  '/images/curtains/room-sheer-white.webp',
]

export default function ImageUploader({ images, onChange }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [dragSource, setDragSource] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)

  function handleFiles(files) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        onChange([...images, e.target.result])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleImageDragStart(idx) {
    setDragSource(idx)
  }

  function handleImageDragOver(e) {
    e.preventDefault()
  }

  function handleImageDrop(targetIdx) {
    if (dragSource === null) return
    const newImages = [...images]
    const [dragged] = newImages.splice(dragSource, 1)
    newImages.splice(targetIdx, 0, dragged)
    onChange(newImages)
    setDragSource(null)
  }

  function removeImage(idx) {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div
        className="image-dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          borderStyle: 'dashed',
          borderWidth: '2px',
          borderColor: dragOver ? 'var(--dash-primary)' : 'var(--dash-border)',
          borderRadius: '0',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? 'rgba(181, 96, 47, 0.05)' : 'transparent',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <p style={{ color: 'var(--dash-muted)' }}>Kéo thả ảnh hoặc click để tải lên</p>
      </div>

      <button
        onClick={() => setShowLibrary(!showLibrary)}
        style={{
          marginTop: '12px',
          background: 'none',
          border: 'none',
          color: 'var(--dash-primary)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
        }}
      >
        {showLibrary ? '← Ẩn thư viện ảnh' : '+ Thêm từ thư viện'}
      </button>

      {showLibrary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginTop: '12px' }}>
          {PRESET_IMAGES.map((img) => (
            <button
              key={img}
              onClick={() => {
                if (!images.includes(img)) {
                  onChange([...images, img])
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--dash-border)',
                borderRadius: '0',
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                height: '80px',
              }}
              title={img}
            >
              <img src={img} alt="lib" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="image-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
          {images.map((img, idx) => (
            <div
              key={idx}
              className="image-thumb"
              draggable
              onDragStart={() => handleImageDragStart(idx)}
              onDragOver={handleImageDragOver}
              onDrop={() => handleImageDrop(idx)}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '0',
                border: '1px solid var(--dash-border)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'move',
              }}
            >
              <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {idx === 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    background: 'var(--dash-primary)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '0',
                  }}
                >
                  Đại diện
                </span>
              )}
              <button
                onClick={() => removeImage(idx)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

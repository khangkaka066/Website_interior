'use client'

import { useRef, useState, useEffect } from 'react'

const PRESET_IMAGES = [
  '/images/curtains/rem-cua-vai-gam-mau-xanh-duong.webp',
  '/images/curtains/rem-cua-vai-gam-mau-den.webp',
  '/images/curtains/rem-cua-vai-gam-mau-nau.webp',
  '/images/curtains/rem-cua-vai-gam-mau-xam-bac.webp',
  '/images/curtains/rem-cua-vai-gam-mau-xam-tim.webp',
  '/images/curtains/rem-cua-vai-gam-mau-vang-gold.webp',
  '/images/curtains/goi-tua-sofa-vai-gam-mau-xam-dam.webp',
  '/images/curtains/rem-dan-tuong-nhieu-mau-sac.webp',
  '/images/curtains/rem-voan-trang-phong-khach.webp',
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
          backgroundColor: dragOver ? 'rgba(148, 107, 8, 0.05)' : 'transparent',
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

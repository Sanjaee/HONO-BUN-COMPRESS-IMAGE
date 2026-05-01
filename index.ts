import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'

// Konfigurasi Cloudinary dari Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const app = new Hono()

// Rute untuk melayani file statis (HTML, CSS, JS) dari root direktori
app.use('/*', serveStatic({ root: './' }))

// Rute API murni untuk menangani proses upload
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const imageFile = body['image'] as File

    if (!imageFile) {
      return c.json({ error: 'Tidak ada gambar yang diunggah' }, 400)
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
       return c.json({ error: 'Kredensial Cloudinary belum diatur di server (.env)' }, 500)
    }

    // Ubah file menjadi buffer untuk diproses sharp
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Kompresi & Konversi ke WebP menggunakan sharp
    const processedBuffer = await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true }) 
      .webp({ quality: 80 }) 
      .toBuffer()

    // Unggah ke Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'bun-hono-uploads',
          resource_type: 'image',
          format: 'webp' 
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )

      uploadStream.end(processedBuffer)
    })

    const result = await uploadPromise as any

    return c.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    })
  } catch (error: any) {
    console.error('Upload Error:', error)
    return c.json({ error: error.message || 'Server Error' }, 500)
  }
})

export default {
  port: 3000,
  fetch: app.fetch,
}
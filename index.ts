import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'

const app = new Hono()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

app.get('/', (c) => c.json({ message: 'API running' }))

app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const imageFile = body.image as File

    if (!imageFile) {
      return c.json({ error: 'No image uploaded' }, 400)
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer())

    const processed = await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'bun-hono-uploads',
          format: 'webp'
        },
        (err, result) => {
          if (err) reject(err)
          else resolve(result)
        }
      )

      stream.end(processed)
    })

    return c.json({
      success: true,
      url: result.secure_url
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default handle(app)
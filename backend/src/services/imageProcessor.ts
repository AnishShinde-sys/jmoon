/**
 * Image Processor Service
 * Handles image uploads, resizing, and thumbnail generation
 */

import sharp from 'sharp'

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface ImageProcessingResult {
  buffer: Buffer
  width: number
  height: number
  format: string
  size: number
}

/**
 * Process and optimize image
 */
export async function processImage(
  buffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 80,
    format = 'jpeg',
  } = options

  try {
    let pipeline = sharp(buffer)

    // Get metadata
    const metadata = await pipeline.metadata()

    // Resize if needed
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
    }

    // Convert format
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 })
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality })
    }

    // Process
    const processed = await pipeline.toBuffer({ resolveWithObject: true })

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
      format: processed.info.format,
      size: processed.data.length,
    }
  } catch (error: any) {
    throw new Error(`Image processing error: ${error.message}`)
  }
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  buffer: Buffer,
  size: number = 200
): Promise<ImageProcessingResult> {
  try {
    const processed = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
      format: processed.info.format,
      size: processed.data.length,
    }
  } catch (error: any) {
    throw new Error(`Thumbnail generation error: ${error.message}`)
  }
}

/**
 * Extract EXIF data from image
 */
export async function extractEXIF(buffer: Buffer): Promise<any> {
  try {
    const metadata = await sharp(buffer).metadata()

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      exif: metadata.exif ? parseEXIF(metadata.exif) : undefined,
    }
  } catch (error: any) {
    throw new Error(`EXIF extraction error: ${error.message}`)
  }
}

/**
 * Parse EXIF buffer to readable object
 * (Simplified - in production you'd want to use exif-parser or similar)
 */
function parseEXIF(exifBuffer: Buffer): any {
  try {
    // This is a simplified version
    // In production, use a proper EXIF parser library
    return {
      raw: exifBuffer.toString('base64'),
    }
  } catch (error) {
    return {}
  }
}

/**
 * Validate image buffer
 */
export async function validateImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata()
    return !!(metadata.width && metadata.height && metadata.format)
  } catch (error) {
    return false
  }
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    }
  } catch (error: any) {
    throw new Error(`Failed to get image dimensions: ${error.message}`)
  }
}

/**
 * Convert image to different format
 */
export async function convertImageFormat(
  buffer: Buffer,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = 80
): Promise<Buffer> {
  try {
    let pipeline = sharp(buffer)

    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 })
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality })
    }

    return await pipeline.toBuffer()
  } catch (error: any) {
    throw new Error(`Image format conversion error: ${error.message}`)
  }
}

/**
 * Process TIFF file and convert to JPG
 * Used for raster dataset uploads
 */
export async function processTIFF(buffer: Buffer): Promise<Buffer> {
  try {
    const jpgBuffer = await sharp(buffer)
      .resize(1000, null, {
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    return jpgBuffer
  } catch (error: any) {
    // If conversion fails, create a placeholder
    console.error('TIFF processing error:', error)
    throw new Error(`TIFF processing error: ${error.message}`)
  }
}

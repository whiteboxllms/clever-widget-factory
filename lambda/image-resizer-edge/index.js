/**
 * Lambda@Edge Image Resizer
 * 
 * On-demand image resizing and format conversion at CloudFront edge locations.
 * 
 * Runtime: Node.js 18.x
 * Memory: 512 MB (Sharp requires more memory for image processing)
 * Timeout: 5 seconds
 * Region: us-east-1 (Lambda@Edge requirement)
 * Trigger: CloudFront origin-request event
 * 
 * Dependencies:
 * - sharp: Image processing library (must be compiled for Lambda environment)
 * - @aws-sdk/client-s3: S3 client for fetching original images
 */

const sharp = require('sharp');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION || 'us-west-2' });

/**
 * Parse query string into key-value object
 * @param {string} querystring - Query string from CloudFront request
 * @returns {Object} Parsed query parameters
 */
function parseQueryString(querystring) {
  if (!querystring) return {};
  
  const params = {};
  querystring.split('&').forEach(param => {
    const [key, value] = param.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });
  
  return params;
}

/**
 * Validate and parse resize options from query parameters
 * @param {Object} params - Query parameters
 * @returns {Object} Validated resize options
 */
function parseResizeOptions(params) {
  const options = {
    width: params.width ? parseInt(params.width, 10) : undefined,
    height: params.height ? parseInt(params.height, 10) : undefined,
    quality: params.quality ? parseInt(params.quality, 10) : 80,
    format: params.format || 'webp'
  };
  
  // Validate width and height
  if (options.width && (isNaN(options.width) || options.width <= 0 || options.width > 4000)) {
    options.width = undefined;
  }
  if (options.height && (isNaN(options.height) || options.height <= 0 || options.height > 4000)) {
    options.height = undefined;
  }
  
  // Validate quality (1-100)
  if (isNaN(options.quality) || options.quality < 1 || options.quality > 100) {
    options.quality = 80;
  }
  
  // Validate format
  if (!['jpeg', 'jpg', 'png', 'webp'].includes(options.format.toLowerCase())) {
    options.format = 'webp';
  }
  
  // Normalize format
  if (options.format === 'jpg') {
    options.format = 'jpeg';
  }
  
  return options;
}

/**
 * Fetch original image from S3
 * @param {string} s3Key - S3 object key
 * @param {string} bucket - S3 bucket name
 * @returns {Promise<Buffer>} Image buffer
 */
async function fetchImageFromS3(s3Key, bucket) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key
    });
    
    const response = await s3Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('S3 fetch error:', error);
    throw error;
  }
}

/**
 * Process image with Sharp based on resize options
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Resize options (width, height, quality, format)
 * @returns {Promise<{buffer: Buffer, contentType: string}>} Processed image
 */
async function processImage(imageBuffer, options) {
  try {
    let pipeline = sharp(imageBuffer);
    
    // Apply resize if width or height specified
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: 'inside',  // Maintain aspect ratio
        withoutEnlargement: true  // Don't upscale small images
      });
    }
    
    // Apply format conversion and quality
    const format = options.format.toLowerCase();
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality: options.quality });
    } else if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: options.quality });
    } else if (format === 'png') {
      pipeline = pipeline.png({ 
        quality: options.quality,
        compressionLevel: 9
      });
    }
    
    const buffer = await pipeline.toBuffer();
    
    // Determine content type
    const contentType = format === 'jpeg' ? 'image/jpeg' :
                       format === 'png' ? 'image/png' :
                       'image/webp';
    
    return { buffer, contentType };
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
}

/**
 * Lambda@Edge handler for origin-request event
 * @param {Object} event - CloudFront origin-request event
 * @returns {Promise<Object>} CloudFront response
 */
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const querystring = request.querystring;
  
  console.log('Processing image request:', { uri, querystring });
  
  try {
    // Parse query parameters
    const params = parseQueryString(querystring);
    const resizeOptions = parseResizeOptions(params);
    
    // Extract S3 key from URI (remove leading slash)
    const s3Key = uri.substring(1);
    
    // Validate S3 key matches organization-scoped pattern
    if (!s3Key.startsWith('organizations/')) {
      console.warn('Invalid S3 key pattern:', s3Key);
      return {
        status: '403',
        statusDescription: 'Forbidden',
        body: 'Invalid image path'
      };
    }
    
    // Get S3 bucket from environment variable
    const bucket = process.env.S3_BUCKET || 'cwf-dev-assets';
    
    // Fetch original image from S3
    const imageBuffer = await fetchImageFromS3(s3Key, bucket);
    
    // If no resize parameters, return original image
    if (!resizeOptions.width && !resizeOptions.height && !params.format && !params.quality) {
      console.log('No resize parameters, returning original image');
      
      // Determine content type from file extension
      const ext = s3Key.split('.').pop().toLowerCase();
      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'png' ? 'image/png' :
                         ext === 'webp' ? 'image/webp' :
                         'image/jpeg';
      
      return {
        status: '200',
        statusDescription: 'OK',
        headers: {
          'content-type': [{ value: contentType }],
          'cache-control': [{ value: 'public, max-age=86400' }],
          'content-length': [{ value: imageBuffer.length.toString() }]
        },
        body: imageBuffer.toString('base64'),
        bodyEncoding: 'base64'
      };
    }
    
    // Process image with resize options
    const { buffer, contentType } = await processImage(imageBuffer, resizeOptions);
    
    console.log('Image processed successfully:', {
      originalSize: imageBuffer.length,
      processedSize: buffer.length,
      options: resizeOptions
    });
    
    // Return processed image
    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [{ value: contentType }],
        'cache-control': [{ value: 'public, max-age=86400' }],
        'content-length': [{ value: buffer.length.toString() }]
      },
      body: buffer.toString('base64'),
      bodyEncoding: 'base64'
    };
    
  } catch (error) {
    console.error('Lambda@Edge error:', error);
    
    // Return error response
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      return {
        status: '404',
        statusDescription: 'Not Found',
        body: 'Image not found'
      };
    }
    
    return {
      status: '500',
      statusDescription: 'Internal Server Error',
      body: 'Image processing failed'
    };
  }
};

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions'
import express from 'express'
import payload from 'payload'
import path from 'path'
import serverless from 'serverless-http'

type InitResult = {
  app: ReturnType<typeof express>;
  payload: {
    authenticate: any;
    router: any;
  };
}

let payloadInstance: InitResult | null = null
let initializationPromise: Promise<InitResult> | null = null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
}

const initializePayload = async () => {
  if (payloadInstance) return payloadInstance
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      console.log('Initializing Payload...')
      const startTime = Date.now()
      
      const app = express()
      app.use(express.json())
      
      const payloadApp = await payload.init({
        express: app,
        secret: process.env.PAYLOAD_SECRET || '',
        db: {
          url: process.env.DATABASE_URI || 'file:/var/data/cms.db',
        },
        admin: {
          disabled: true
        }
      })

      app.use(payloadApp.authenticate)
      app.use('/api', payloadApp.router)
      app.use('/media', express.static('/var/data/media'))
      
      const initTime = Date.now() - startTime
      console.log(`Payload initialized in ${initTime}ms`)
      
      payloadInstance = { app, payload: payloadApp }
      initializationPromise = null
      return payloadInstance
      
    } catch (error) {
      console.error('Payload initialization failed:', error)
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

export const handler: Handler = async (
  event: HandlerEvent, 
  context: HandlerContext
): Promise<HandlerResponse> => {
  context.callbackWaitsForEmptyEventLoop = false
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    console.log(`Processing ${event.httpMethod} request to ${event.path}`)
    const startTime = Date.now()
    
    const { app } = await initializePayload()
    
    if (event.path) {
      event.path = event.path.replace('/.netlify/functions/payload', '')
    }
    
    const serverlessHandler = serverless(app)
    const response = await serverlessHandler(event, context)
    const processTime = Date.now() - startTime
    console.log(`Request processed in ${processTime}ms`)
    
    return {
      statusCode: response.statusCode,
      headers: {
        ...corsHeaders,
        ...response.headers
      },
      body: response.body
    }

  } catch (error) {
    console.error('Request processing error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}
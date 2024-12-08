import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions'
import express from 'express'
import payload from 'payload'
import path from 'path'
import serverless from 'serverless-http'

let payloadInstance: any = null

const initializePayload = async () => {
  if (!payloadInstance) {
    const app = express()
    
    const instance = await payload.init({
      express: app,
      secret: process.env.PAYLOAD_SECRET || '',
      db: {
        url: process.env.DATABASE_URI || 'file:/var/data/cms.db',
      },
      admin: {
        disabled: true
      }
    })

    app.use(instance.authenticate)
    app.use('/api', instance.router)
    app.use('/media', express.static('/var/data/media'))
    
    payloadInstance = { app, payload: instance }
  }
  return payloadInstance
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
}

export const handler: Handler = async (
  event: HandlerEvent, 
  context: HandlerContext
): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    const { app } = await initializePayload()
    
    // Remove '/.netlify/functions/payload' from path
    if (event.path) {
      event.path = event.path.replace('/.netlify/functions/payload', '')
    }
    
    const serverlessHandler = serverless(app)
    const response = await serverlessHandler(event, context)
    
    return {
      statusCode: response.statusCode,
      headers: {
        ...corsHeaders,
        ...response.headers
      },
      body: response.body
    }

  } catch (error) {
    console.error('Payload Error:', error)
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
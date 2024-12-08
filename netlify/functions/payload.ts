import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions'
import express from 'express'
import serverless from 'serverless-http'
import payload from 'payload'
import { resolve } from 'path'
import config from '../../cms/src/payload.config'

let payloadInstance: any = null

const initializePayload = async () => {
  if (!payloadInstance) {
    const app = express()
    payloadInstance = await payload.init({
      express: app,
      secret: process.env.PAYLOAD_SECRET || '',
      db: {
        ...config.db,
        url: process.env.DATABASE_URI || 'file:/var/data/cms.db',
      },
      admin: {
        disabled: true
      }
    })
  }
  return payloadInstance
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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
    const app = express()
    const payload = await initializePayload()
    const serverlessHandler = serverless(app)

    const response = await serverlessHandler(event, context)
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('Payload Error:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}
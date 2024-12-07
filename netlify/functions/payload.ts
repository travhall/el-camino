// netlify/functions/payload.ts
import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions'

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<HandlerResponse> => {
  try {
    const response: HandlerResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        message: 'Payload function is running',
        path: event.path,
        method: event.httpMethod,
        timestamp: new Date().toISOString()
      })
    }
    
    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    const errorResponse: HandlerResponse = {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      })
    }
    
    return errorResponse
  }
}
const { NotifyClient } = require('notifications-node-client')
const { v4: uuid } = require('uuid')

const notifyClientApiKey = process.env.NOTIFY_CLIENT_API_KEY
const notifyTemplateId = process.env.NOTIFY_TEMPLATE_ID

const notifyClient = new NotifyClient(notifyClientApiKey)

function isErrorOkToTryAgain (error) {
  return ['EAI_AGAIN', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(error?.code) || [403].includes(error?.status_code)
}

function isRateLimitExceeded (error) {
  return error?.status_code === 429
}

module.exports = async function (context) {
  const { notification } = context.bindings
  context.log('Message To Send Queue Trigger function activated for:', notification)

  try {
    const { message, phoneNumber } = notification
    await notifyClient.sendSms(notifyTemplateId, phoneNumber, {
      personalisation: { message },
      reference: uuid()
    })
  } catch (e) {
    const { dequeueCount } = context.bindingData
    const error = e?.response?.data ?? e
    context.log.error(error)

    if (isRateLimitExceeded(error)) {
      // Do not rethrow, move to rateLimitExceeded queue.
      context.bindings.rateLimitExceeded = {
        error,
        notification
      }
    } else {
      // Message will go to poision queue after dequeueCount has reached max
      // (default 5). We don't want to use poision queue as it doesn't include
      // the error message so add to failed queue.
      if (dequeueCount < 5 && isErrorOkToTryAgain(error)) {
        context.log.warn('Message sending has failed but is ok to try again', notification)
        // Throwing error causes the message to be added back to the queue with
        // dequeueCount incremented (happens automatically)
        throw new Error(e)
      } else {
        context.log.warn('add to failed queue')
        // Add to failed queue for later analysis, no auto reprocessing
        context.bindings.failed = {
          error,
          notification
        }
      }
    }
  }
}

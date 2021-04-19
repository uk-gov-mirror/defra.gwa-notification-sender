const mockCreateIfNotExists = jest.fn()
const mockSendMessage = jest.fn()
const mockQueueClient = jest.fn(() => {
  return {
    createIfNotExists: mockCreateIfNotExists,
    sendMessage: mockSendMessage
  }
})

module.exports = {
  mocks: {
    mockCreateIfNotExists,
    mockQueueClient,
    mockSendMessage
  },
  QueueClient: mockQueueClient
}

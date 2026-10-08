import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { openEventStream } from '../utils/eventStream'

const sse = (...blocks) => {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(c) {
      blocks.forEach((b) => c.enqueue(enc.encode(b)))
      c.close()
    },
  })
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, body })
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'tok', setItem() {}, removeItem() {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('openEventStream', () => {
  test('báo open khi nối, rồi từng sự kiện; bỏ qua dòng ping và dữ liệu hỏng', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(200, sse('retry: 3000\n\n', 'event: chat\ndata: {"type":"message","sender":"ADMIN"}\n\n', ': ping\n\n', 'data: {hỏng\n\n', 'event: chat\ndata: {"type":"read"}\n\n')))
      .mockImplementation(() => new Promise(() => {})) // lần nối lại treo, không phát sinh gì thêm
    vi.stubGlobal('fetch', fetchMock)
    const got = []
    const close = openEventStream('/chat/stream', (e) => got.push(e.type))
    await tick(60)
    close()
    expect(got.slice(0, 3)).toEqual(['open', 'message', 'read'])
  })

  test('sự kiện bị cắt đôi giữa hai gói vẫn đọc đúng', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(200, sse('event: chat\ndata: {"type":"mes', 'sage"}\n\n'))).mockImplementation(() => new Promise(() => {})))
    const got = []
    const close = openEventStream('/x', (e) => got.push(e.type))
    await tick(60)
    close()
    expect(got).toContain('message')
  })

  test('gửi token đăng nhập trong header', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const close = openEventStream('/chat/stream', () => {})
    await tick()
    close()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/chat\/stream$/)
  })

  test.each([401, 403, 404])('mã %i thì không nối lại', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(response(status, null))
    vi.stubGlobal('fetch', fetchMock)
    const got = []
    openEventStream('/x', (e) => got.push(e.type))
    await tick(1200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(got).toEqual([])
  })

  test('mất kết nối thì nối lại và báo open lần nữa', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, sse('event: chat\ndata: {"type":"message"}\n\n'))) // hết luồng = bị ngắt
      .mockResolvedValueOnce(response(200, sse('event: chat\ndata: {"type":"read"}\n\n')))
      .mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const got = []
    const close = openEventStream('/x', (e) => got.push(e.type))
    await tick(1500)
    close()
    expect(got.filter((t) => t === 'open').length).toBeGreaterThanOrEqual(2)
    expect(got).toContain('read')
  })

  test('đóng luồng thì dừng hẳn', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, sse()))
    vi.stubGlobal('fetch', fetchMock)
    const close = openEventStream('/x', () => {})
    await tick(30)
    close()
    const calls = fetchMock.mock.calls.length
    await tick(1500)
    expect(fetchMock.mock.calls.length).toBe(calls)
  })
})

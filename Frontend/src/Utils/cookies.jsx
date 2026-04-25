export function getCookie(name) {
  const pattern = `(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`
  const match = document.cookie.match(new RegExp(pattern))
  return match ? decodeURIComponent(match[1]) : ''
}

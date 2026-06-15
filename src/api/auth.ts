import { request } from './client'

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type UserResponse = {
  id: string
  email: string
}

export function register(email: string, password: string) {
  return request<UserResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password })
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
}

export function logout(token: string) {
  return request<{ detail: string }>('/auth/logout', { method: 'POST', token })
}

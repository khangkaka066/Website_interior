import { z } from 'zod'
import { email } from './common.js'

export const subscribeSchema = z.object({ email: email })

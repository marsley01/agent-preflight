'use client';
import { createClient } from '@neon/neon-js';

export const neon = createClient(process.env.NEXT_PUBLIC_NEON_DATA_API_URL!);
export const myOrders = () => neon.from('orders').select('*');

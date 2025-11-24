
import { describe, it, expect, vi } from 'vitest';
import { SSRRenderer } from './ssr.js';
import { Serializer } from '../shared/serialization.js';
import { createRPCRegistry, defineRPC, RPCContext } from './rpc.js';
import { World } from '../core/world.js';

describe('Security Fixes', () => {
    describe('XSS Prevention in SSR', () => {
        it('should escape style attributes', () => {
            const renderer = new SSRRenderer();
            const vnode = {
                type: 'div',
                props: {
                    style: 'color: red"; onload="alert(1)'
                },
                children: []
            };

            const html = renderer.renderToString(vnode);
            expect(html).toContain('style="color: red&quot;; onload=&quot;alert(1)"');
            expect(html).not.toContain('onload="alert(1)"');
        });

        it('should escape style objects', () => {
            const renderer = new SSRRenderer();
            const vnode = {
                type: 'div',
                props: {
                    style: {
                        color: 'red"; onload="alert(1)'
                    }
                },
                children: []
            };

            const html = renderer.renderToString(vnode);
            expect(html).toContain('color:red&quot;; onload=&quot;alert(1)');
        });
    });

    describe('Prototype Pollution Prevention', () => {
        it('should not allow __proto__ pollution', () => {
            const serializer = new Serializer();
            const maliciousPayload = JSON.parse('{"__proto__": {"polluted": true}}');

            // @ts-ignore - Accessing private method for testing
            const result = serializer.deserializeValue(maliciousPayload);

            expect(({} as any).polluted).toBeUndefined();
            expect(result.polluted).toBeUndefined();
            expect(result.__proto__).toEqual(Object.prototype);
        });

        it('should not allow constructor pollution', () => {
            const serializer = new Serializer();
            const maliciousPayload = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}');

            // @ts-ignore
            const result = serializer.deserializeValue(maliciousPayload);

            expect(({} as any).polluted).toBeUndefined();
            expect(result.constructor).toBe(Object);
        });
    });

    describe('Rate Limiting', () => {
        it('should use IP for rate limiting when clientId is missing', async () => {
            const registry = createRPCRegistry();
            const world = new World();

            registry.register(defineRPC('test', () => 'ok', {
                rateLimit: { maxCalls: 1, windowMs: 1000 }
            }));

            const context1: RPCContext = { world, ip: '1.1.1.1' };
            const context2: RPCContext = { world, ip: '2.2.2.2' };

            // First call from IP 1 - success
            await expect(registry.execute({
                id: '1', method: 'test', args: {}, timestamp: Date.now()
            }, context1)).resolves.toHaveProperty('result', 'ok');

            // Second call from IP 1 - fail
            const res1 = await registry.execute({
                id: '2', method: 'test', args: {}, timestamp: Date.now()
            }, context1);
            expect(res1.error?.code).toBe('RATE_LIMIT_EXCEEDED');

            // First call from IP 2 - success (should have separate bucket)
            await expect(registry.execute({
                id: '3', method: 'test', args: {}, timestamp: Date.now()
            }, context2)).resolves.toHaveProperty('result', 'ok');
        });
    });
});

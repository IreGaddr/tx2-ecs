/**
 * Error handling types and utilities
 */

import { SystemId } from './system.js';
import { logger } from './logger.js';

export class TX2Error extends Error {
    constructor(message: string, public code: string, public data?: any) {
        super(message);
        this.name = 'TX2Error';
    }
}

export enum SystemErrorStrategy {
    DISABLE = 'DISABLE', // Disable the failing system
    IGNORE = 'IGNORE',   // Log and continue
    RETRY = 'RETRY',     // Retry immediately (dangerous if infinite loop)
}

export interface SystemErrorContext {
    systemId: SystemId;
    error: Error;
    phase: string;
    consecutiveFailures: number;
}

export type SystemErrorHandler = (ctx: SystemErrorContext) => SystemErrorStrategy | void;

export const defaultErrorHandler: SystemErrorHandler = (ctx) => {
    logger.error(`System ${ctx.systemId} failed in phase ${ctx.phase}`, {
        error: ctx.error.message,
        stack: ctx.error.stack,
        failures: ctx.consecutiveFailures,
    });

    // If it fails more than 3 times in a row, disable it
    if (ctx.consecutiveFailures >= 3) {
        logger.warn(`System ${ctx.systemId} disabled due to excessive failures`);
        return SystemErrorStrategy.DISABLE;
    }

    return SystemErrorStrategy.IGNORE;
};

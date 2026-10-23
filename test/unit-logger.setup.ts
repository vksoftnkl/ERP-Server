import { Logger } from '@nestjs/common';

/**
 * Unit runs (the package.json "jest" config) print Nest errors only. A
 * service's info and warning lines — the font registry loading, a PDF
 * rendered, a GSTIN lookup refused on purpose — read like trouble in a run
 * that should say only PASS or FAIL.
 *
 * A spec that triggers an error on purpose mutes and asserts it itself
 * (`jest.spyOn(Logger.prototype, 'error')`), so an ERROR that still prints is
 * one nobody expected. A spy on Logger.prototype still sees every call.
 *
 * `TEST_LOGS=1 npx jest <spec>` prints everything again, for debugging.
 */
if (!process.env.TEST_LOGS) {
  Logger.overrideLogger(['error']);
}

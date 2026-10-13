import { beforeEach, describe, expect, it } from 'vitest'
import { settings } from './settings.mts'

beforeEach(() => {
	settings.value.reset()
})

describe('settings', () => {
	it('keeps the reading speed on a stop between half and triple', () => {
		settings.value.setSpeechRate(1.6)
		expect(settings.value.speechRate).toBe(1.5)
		settings.value.setSpeechRate(5)
		expect(settings.value.speechRate).toBe(3)
		settings.value.setSpeechRate(0)
		expect(settings.value.speechRate).toBe(0.5)
	})

	it('keeps a voice per language, and forgets it for the system\'s own', () => {
		settings.value.chooseVoice('en-GB', 'daniel')
		settings.value.chooseVoice('nl_NL', 'xander')
		expect(settings.value.voices).toEqual({ en: 'daniel', nl: 'xander' })
		settings.value.chooseVoice('en-US', undefined)
		expect(settings.value.voices).toEqual({ nl: 'xander' })
	})
})

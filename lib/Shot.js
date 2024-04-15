import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const { PuppeteerBlocker } = require('@cliqz/adblocker-puppeteer');

export default class Shot {
	constructor() {
		this.browser = null;
		this.blocker = null;
	}

	async initializeBrowser() {
		if (!this.browser) {
			this.browser = await puppeteer.launch({
				args: minimal_args,
				headless: 'shell'
			});
		}
	}

	async initializeBlocker() {
		if (!this.blocker) {
			this.blocker = await PuppeteerBlocker.fromLists(fetch, [
				'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt'
			]);
		}
	}
}

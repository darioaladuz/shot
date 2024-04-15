import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const { PuppeteerBlocker } = require('@cliqz/adblocker-puppeteer');
const fetch = require('cross-fetch');

const autoconsent = require('@duckduckgo/autoconsent/dist/autoconsent.puppet.js');
const extraRules = require('@duckduckgo/autoconsent/rules/rules.json');

const consentomatic = extraRules.consentomatic;
const rules = [
	...autoconsent.rules,
	...Object.keys(consentomatic).map(
		(name) =>
			new autoconsent.ConsentOMaticCMP(`com_${name}`, consentomatic[name])
	),
	...extraRules.autoconsent.map((spec) => autoconsent.createAutoCMP(spec))
];

import * as fsExtra from 'fs-extra';
import { setTimeout } from 'node:timers/promises';
import { minimal_args, blocked_domains } from './puppeteer.config';

const devices = [
	{
		name: 'desktop',
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
		viewport: { width: 1920, height: 1080, isMobile: false }
	},
	{
		name: 'tablet',
		userAgent:
			'Mozilla/5.0 (Linux; Android 12; SM-X906C Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.119 Mobile Safari/537.36',
		viewport: { width: 768, height: 1024, isMobile: true }
	},
	{
		name: 'mobile',
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
		viewport: { width: 375, height: 812, isMobile: true }
	}
];

export default class Shot {
	constructor() {
		this.browser = null;
		this.blocker = null;
		this.logs = null;
	}

	async initializeBrowser() {
		if (!this.browser) {
			this.browser = await puppeteer.launch({
				args: minimal_args,
				headless: 'shell'
			});
		}
	}

	async closeBrowser() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}

	async initializeBlocker() {
		if (!this.blocker) {
			this.blocker = await PuppeteerBlocker.fromLists(fetch, [
				'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt'
			]);
		}
	}

	initializeLogs(filePath) {
		if (!this.logs) {
			this.logs = {
				latest_attempt: '',
				failed: [],
				httpErrors: []
			};

			if (fsExtra.existsSync(filePath)) {
				try {
					// Read the existing JSON file to get its structure
					const existingData = fsExtra.readFileSync(filePath, 'utf-8');
					const existingLogs = JSON.parse(existingData);

					// Update logs with the structure of the existing file
					Object.assign(this.logs, existingLogs);

					console.log('Retrieved existing JSON file structure:', filePath);
				} catch (error) {
					console.error('Error creating JSON file:', error);
				}
			} else {
				// If the file doesn't exist, create it with the initial structure
				try {
					fsExtra.writeFileSync(filePath, JSON.stringify(this.logs, null, 2));
					console.log('Created new JSON file:', filePath);
				} catch (error) {
					console.error('Error creating JSON file:', error);
				}
			}
		}
	}

	updateLogs(logType, index, url, filePath) {
		try {
			// Update the error cases object with the provided URLs
			if (logType === 'latest_attempt') {
				this.logs['latest_attempt'] = { index, url };
			} else {
				if (!this.logs[logType].some((el) => el.url === url)) {
					this.logs[logType].push({ index, url });
				} else {
					console.log("it's already in there!");
				}
			}
			// Write the updated data back to the JSON file
			fsExtra.writeFileSync(filePath, JSON.stringify(this.logs, null, 2));
			console.log(`Updated ${logType} error cases in ${filePath}`);
		} catch (error) {
			console.error('Error updating JSON file:', error);
		}
	}

	async autoConsentCookies(page, url) {
		page.once('load', async () => {
			const tab = autoconsent.attachToPage(page, url, rules, 10);
			try {
				await tab.checked;
				await tab.doOptIn();
			} catch (e) {
				console.warn(`CMP error`, e);
			}
		});
	}

	async capture(url, filename, ext, timeout = 0, i) {
		await this.initializeBlocker();
		await this.initializeBrowser();
		this.initializeLogs();

		const page = await this.browser.newPage();

		let result = {
			desktop: '',
			tablet: '',
			mobile: '',
			status: 0
		};

		try {
			if (url && url !== '') {
				await this.blocker.enableBlockingInPage(page);

				await page.setRequestInterception(true);

				page.on('request', (request) => {
					const url = request.url();
					if (blocked_domains.some((domain) => url.includes(domain))) {
						request.abort();
					} else {
						request.continue();
					}
				});

				await this.autoConsentCookies(page, url);

				const response = await page.goto(url, {
					waitUntil: ['domcontentloaded', 'networkidle0']
				});

				for (const device of devices) {
					await page.setUserAgent(device.userAgent);
					await page.setViewport(device.viewport);

					if (timeout > 0) {
						await setTimeout(timeout);
					}

					const screenshot = await page.screenshot({
						type: ext,
						path: `screenshots/${
							device.name.charAt(0).toUpperCase() + device.name.slice(1)
						}/${filename}.${ext}`
					});

					result[device.name] = screenshot;
				}

				const status = response.status();

				if (status < 200 || status > 299) {
					this.updateLogs('http', i + 1, url, 'url_errors.json');
				}

				result['status'] = response.status();
			}
		} catch (error) {
			console.error(`Failed to capture screenshot for ${url}: ${error}`);

			this.updateLogs('failed', i + 1, url, 'url_errors.json');
		} finally {
			if (page) {
				await page.close();
			}
		}

		return result;
	}

	async captureMany(urls, ext, timeout = 0) {
		let start = Date.now();

		if (fsExtra.existsSync('screenshots')) {
			fsExtra.emptyDirSync('screenshots');
		}

		fsExtra.remove('screenshots.zip');
		const screenshots = [];

		const directories = [
			'screenshots/Desktop/',
			'screenshots/Tablet/',
			'screenshots/Mobile/'
		];

		directories.forEach((directory) => {
			if (!fsExtra.existsSync(directory)) {
				fsExtra.mkdirSync(directory, { recursive: true });
			}
		});

		const formattedURLS = urls.filter((url) => url);

		try {
			let startingIdx = 0;

			for (let i = startingIdx; i < formattedURLS.length; i++) {
				const url = formattedURLS[i];

				this.updateLogs('latest_attempt', i + 1, url, 'url_errors.json');

				const filename = String(i + 1).padStart(5, '0');

				const { desktop, tablet, mobile, status } = await this.capture(
					url,
					filename,
					ext,
					timeout,
					i
				);

				screenshots.push({
					desktop,
					tablet,
					mobile,
					status
				});
			}

			let timeTaken = Date.now() - start;

			console.log(`${timeTaken} ms`);

			return screenshots;
		} catch (error) {
			console.log('Error: ', error);
		} finally {
			this.closeBrowser();
		}
	}
}

'use client';
import { useState } from 'react';

export default function Home() {
	const [urls, setUrls] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [ext, setExt] = useState('jpeg');
	const [loadTimeout, setLoadTimeout] = useState(0);
	const [screenshots, setScreenshots] = useState(null);

	const handleCaptureScreenshots = async () => {
		setIsCreating(true);
		setScreenshots(null);

		try {
			const response = await fetch('/api/screenshot', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					urls: urls.split(/[\s,\\]+/),
					ext,
					timeout: loadTimeout
				})
			});

			const data = await response.json();

			setScreenshots(data.screenshots);
			setIsCreating(false);
		} catch (error) {
			console.error('Error capturing screenshots:', error);
		}
	};

	const handleDownloadScreenshots = async () => {
		if (screenshots) {
			const downloadLink = document.createElement('a');
			downloadLink.href = '/api/download';
			downloadLink.download = 'screenshots.zip';
			document.body.appendChild(downloadLink);
			downloadLink.click();
		}
	};

	return (
		<main>
			<div>
				<textarea
					value={urls}
					onChange={(e) => setUrls(e.target.value)}
					cols={30}
					rows={10}
				></textarea>
				<button onClick={handleCaptureScreenshots}>Capture Screenshots</button>
				<button disabled={!screenshots} onClick={handleDownloadScreenshots}>
					{isCreating ? 'Creating screenshots...' : 'Download Screenshots!'}
				</button>
				<div className='input-group'>
					<select
						defaultValue={ext}
						onChange={(e) => setExt(e.target.value)}
						name='extension'
						id='extension'
					>
						{/* <option value='jpg'>JPG</option> */}
						<option value='jpeg'>JPEG</option>
						<option value='png'>PNG</option>
						<option value='webp'>WEBP</option>
					</select>
				</div>
				<div className='input-group'>
					<label htmlFor='timeout'>Timeout after page load (in ms)</label>
					<input
						type='number'
						name='timeout'
						id='timeout'
						placeholder='1000'
						defaultValue={loadTimeout}
						onChange={(e) => setLoadTimeout(e.target.value)}
						step={100}
						min='0'
						max='10000'
					/>
				</div>
			</div>
			<div className='screenshots'>
				{screenshots &&
					screenshots.map((screenshot) => {
						return (
							<div key={JSON.stringify(screenshot)} className='screenshot'>
								<p className='badge screenshot-status'>{screenshot.status}</p>
								{screenshot.desktop.data && (
									<>
										<BufferImage buffer={screenshot.desktop} screen='desktop' />
										<BufferImage buffer={screenshot.tablet} screen='tablet' />
										<BufferImage buffer={screenshot.mobile} screen='mobile' />
									</>
								)}
							</div>
						);
					})}
			</div>
		</main>
	);
}

function BufferImage({ buffer, screen }) {
	const base64Image = Buffer.from(buffer.data).toString('base64');

	const imgSrc = `data:image/png;base64,${base64Image}`;

	return (
		<div className='screenshot-img'>
			<span className='badge screenshot-screen'>{screen}</span>
			<img data-screen={screen} src={imgSrc} />
		</div>
	);
}

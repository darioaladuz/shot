import AdmZip from 'adm-zip';
import fs from 'fs';

const zipDirectory = async (sourceDir, outputFilePath) => {
	const zip = new AdmZip();
	zip.addLocalFolder(sourceDir);
	await zip.writeZipPromise(outputFilePath);
	return zip;
};

export async function GET() {
	const headers = new Headers();

	headers.append('Content-Disposition', 'attachment; filename=screenshots.zip');
	headers.append('Content-Type', 'application/zip');

	console.log('Generating screenshots zip file...');

	const screenshotsFolderExists = fs.existsSync('screenshots');

	if (!screenshotsFolderExists) {
		console.log('Screenshots folder does not exist.');
		return new Response('Screenshots folder does not exist.', { status: 404 });
	}

	// Generate the zip file
	const zipFile = await zipDirectory('screenshots', 'screenshots.zip');
	const outerZipBuffer = zipFile.toBuffer();

	return new Response(outerZipBuffer, { headers });
}

import Shot from '@/lib/Shot';

export async function POST(request) {
	try {
		const body = await request.json();
		const { urls, ext, timeout } = body;

		const shot = new Shot();

		const screenshots = await shot.captureMany(urls, ext, timeout);

		return Response.json({ screenshots });
	} catch (error) {
		console.error('Error capturing screenshots:', error);
		return Response.json({ error: error.message });
	}
}

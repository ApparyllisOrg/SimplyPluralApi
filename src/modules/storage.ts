import * as minio from "minio";

const minioClient = new minio.Client({
    endPoint: 'localhost',
    port: 9001,
	useSSL: false,
    accessKey: process.env.MINIO_KEY!,
    secretKey: process.env.MINIO_SECRET!
});

//-------------------------------//
// Get a file from storage
//-------------------------------//
export const getFileFromStorage = async (path: string): Promise<Buffer[] | null> => {
	return new Promise<Buffer[] | null>(async (resolve, reject) =>
	{
		try {
			const file = await minioClient.getObject("spaces", path)

			var buffer : Buffer[] = [];

			file.on('data', function(chunk) {
				buffer.push(chunk)
			})
			file.on('end', function() {
				resolve(buffer)
			})
			file.on('error', function(e) {
				resolve(null)
			})
		} catch (e)
		{
			console.log(e)
			resolve(null)
		}
	});
};
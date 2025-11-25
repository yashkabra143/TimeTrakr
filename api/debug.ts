export default function handler(req: any, res: any) {
    res.status(200).json({
        message: "Debug endpoint working",
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_DB_URL: !!process.env.DATABASE_URL,
        },
        time: new Date().toISOString()
    });
}

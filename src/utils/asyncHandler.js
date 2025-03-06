// Desc: Async Handler for handling async functions
function asyncHanlder(fn) {
    return async (req, res, next) => {
        try {
            await fn(req, res, next)
        } catch (error) {
            res.status(error.code || 500).json({
                success: false,
                message: error.message || 'Server Error'
            })

        }
    }
}
export {asyncHanlder}
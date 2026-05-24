export const responseSuccess = (res, data = null, message = 'Success') => {
    res.json({
        code: 200,
        message,
        data
    })
}

export const responseError = (res, message = 'Error', code = 500) => {
    res.status(code).json({
        code,
        message
    })
}

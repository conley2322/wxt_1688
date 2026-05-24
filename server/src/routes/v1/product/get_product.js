
export const getProduct = (req, res) => {
    console.log('req.params.id:', typeof req.params.id)
    console.log('req.params.id:', req.params.id)
    console.log('这个是已经获取到的 sql 数据');
    const product = req.db.get('SELECT * FROM products WHERE offer_id = ?', [req.params.id])

    console.log('product:', product)
    res.json({
        code: 200,
        message: 'Success',
        data: product
    })
}



export function recordProductView(req, res) {
    //uuid 
    const id = crypto.randomUUID()
    console.log(res.params);



    console.log('req.product.id', req.product.id);
    console.log('req.user.id', req.user.id);

    req.db.run(
        'INSERT INTO view_records (id, product_id, user_id) VALUES (?, ?, ?)',
        [id, req.product.id, req.user.id]
    )


}
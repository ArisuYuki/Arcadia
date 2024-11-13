// 已收藏专辑列表
const request = require('../util/request.cjs')

exports.url = "/album/sublist";
exports.fn = async (req, res) => {
  const query = req.body;
  const url = "/api/album/sublist";
  const data = {
    limit: query.limit || 25,
    offset: query.offset || 0,
    total: true,
  };
  const options = {
    crypto: "weapi",
    cookie: req.cookies,
    headers: {},
  };
  const answer = await request(url, data, options);
  return res
    .set("Set-Cookie", answer.cookie)
    .status(answer.status)
    .json(answer.data);
};
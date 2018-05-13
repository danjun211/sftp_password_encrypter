/**
 * @author LeeJuneyol
 * @description sftp.json 파일을 읽고, sftp 비밀번호를 암호화하여 저장한다.
 * 기본적으로 sftp 폴더와 같은 위치에 두어 사용한다. node 매개변수로 경로를 직접 설정할 수 있다.
 */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const algorithm = "aes-256-cbc";

const filePath = (process.argv.length > 2)? process.argv.slice(2)[0] : "./sftp.json";

let password = null;

fs.readFile(path.normalize(filePath), (err, data) => {
  if (err) throw err;

  let sftpConfig = JSON.parse(data);

  if(!sftpConfig.isEncrypted) {
    sftpConfig.password = encrypt(sftpConfig.password);
    sftpConfig.isEncrypted = true;

    fs.writeFile(path.normalize(filePath), JSON.stringify(sftpConfig), (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
  }
});

function encrypt(originPassword, key = "sftp_password") {
  var cipher = crypto.createCipher(algorithm, key);
  var encryptedPassword = cipher.update(originPassword, "utf8", "base64");
  encryptedPassword += cipher.final("base64");

  return encryptedPassword;
}

function decrypt(encryptedPassword, key = "sftp_password") {
  var decipher = crypto.createDecipher(algorithm, key);
  var decryptedPassword = decipher.update(encryptedPassword, "base64", "utf8");
  decryptedPassword += decipher.final("utf8");

  return decryptedPassword;
}
# Serviço `backup` (§182): pg_dump agendado + espelhamento do bucket, com retenção configurável.
FROM postgres:16-alpine
RUN apk add --no-cache rclone tzdata
COPY docker/backup/backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]

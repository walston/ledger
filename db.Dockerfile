FROM postgres:10.11
ENV POSTGRES_USER docker
ENV POSTGRES_PASSWORD 2gq3tRLXa!hik3C4W9
ENV POSTGRES_DB ledger
COPY database.sql /docker-entrypoint-initdb.d/
EXPOSE 5432

FROM php:8.3-apache

# Install system dependencies and PHP extensions required for KMZ/KML parsing (zip, libxml)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzip-dev \
    libxml2-dev \
    zip \
    unzip \
    && docker-php-ext-install zip dom xml xmlreader \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache rewrite and headers modules
RUN a2enmod rewrite headers

# Configure Apache DocumentRoot to point to /var/www/html/public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Configure PHP settings for file uploads and memory limit
RUN echo "upload_max_filesize = 25M" >> /usr/local/etc/php/conf.d/custom.ini \
    && echo "post_max_size = 26M" >> /usr/local/etc/php/conf.d/custom.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/custom.ini \
    && echo "max_execution_time = 30" >> /usr/local/etc/php/conf.d/custom.ini \
    && echo "expose_php = Off" >> /usr/local/etc/php/conf.d/custom.ini

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Make entrypoint script executable and set proper permissions
RUN chmod +x /var/www/html/docker-entrypoint.sh \
    && chown -R www-data:www-data /var/www/html

# Expose standard HTTP port
EXPOSE 80

ENTRYPOINT ["/var/www/html/docker-entrypoint.sh"]

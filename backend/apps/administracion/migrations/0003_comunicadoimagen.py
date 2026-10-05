import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('administracion', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ComunicadoImagen',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('imagen', models.ImageField(upload_to='comunicados/%Y/%m/')),
                ('comunicado', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='imagenes', to='administracion.comunicado')),
            ],
            options={
                'verbose_name': 'imagen de comunicado',
                'verbose_name_plural': 'imágenes de comunicados',
                'ordering': ['id'],
            },
        ),
    ]

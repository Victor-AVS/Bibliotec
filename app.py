from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

PSYCOPG_VER = 0
try:
    import psycopg
    from psycopg.rows import dict_row
    PSYCOPG_VER = 3
except Exception:
    try:
        import psycopg2
        import psycopg2.extras
        PSYCOPG_VER = 2
    except Exception:
        pass

app = Flask(__name__)
CORS(app)

DB_URI = "postgresql://postgres.tovcoonzsecnnpnoekzw:Vesv050423..@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=10"

def get_db_connection():
    if PSYCOPG_VER == 3:
        return psycopg.connect(DB_URI)
    elif PSYCOPG_VER == 2:
        return psycopg2.connect(DB_URI)
    else:
        raise RuntimeError("Neither psycopg nor psycopg2 could be loaded.")

def get_cursor(conn):
    if PSYCOPG_VER == 3:
        return conn.cursor(row_factory=dict_row)
    else:
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def release_db_connection(conn):
    try:
        if conn:
            conn.close()
    except Exception:
        pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "Bibliotec backend is online", "driver": f"psycopg_v{PSYCOPG_VER}"})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("SELECT COUNT(*) as total_libros, SUM(stock_disponible) as total_disponibles FROM libro;")
        res = cursor.fetchone()
        return jsonify({
            "success": True,
            "total_libros": res['total_libros'],
            "total_disponibles": res['total_disponibles'] or 0
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            SELECT id_evento, titulo, descripcion, imagen_url, fecha_inicio, fecha_fin
            FROM evento
            WHERE activo = TRUE
            ORDER BY id_evento ASC;
        """)
        eventos = cursor.fetchall()
        return jsonify({"success": True, "eventos": eventos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("SELECT id_categoria, categoria FROM categoria ORDER BY id_categoria ASC;")
        categorias = cursor.fetchall()
        return jsonify({"success": True, "categorias": categorias})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/libros', methods=['GET'])
def get_libros():
    q = request.args.get('q', '').strip()
    cat_filter = request.args.get('categoria', '').strip()
    limit = request.args.get('limit', 20, type=int)

    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        sql = """
            SELECT 
                l.id_libro,
                l.titulo,
                l.sinopsis,
                l.anio,
                l.stock_total,
                l.stock_disponible,
                l.isbn,
                l.puntos_otorgados,
                l.promedio_calificacion,
                l.portada_url,
                c.categoria,
                e.editorial,
                STRING_AGG(CONCAT(a.nombre, ' ', COALESCE(a.a_paterno, '')), ', ') as autor
            FROM libro l
            JOIN categoria c ON l.id_categoria = c.id_categoria
            JOIN editorial e ON l.id_editorial = e.id_editorial
            LEFT JOIN libro_autor la ON l.id_libro = la.id_libro
            LEFT JOIN autor a ON la.id_autor = a.id_autor
            WHERE 1=1
        """
        params = []

        if q:
            sql += " AND (l.titulo ILIKE %s OR a.nombre ILIKE %s OR a.a_paterno ILIKE %s OR l.isbn ILIKE %s)"
            search_param = f"%{q}%"
            params.extend([search_param, search_param, search_param, search_param])

        if cat_filter and cat_filter != 'Todos':
            sql += " AND c.categoria ILIKE %s"
            params.append(f"%{cat_filter}%")

        sql += """
            GROUP BY l.id_libro, c.categoria, e.editorial
            ORDER BY l.id_libro ASC
            LIMIT %s;
        """
        params.append(limit)

        cursor.execute(sql, params)
        libros = cursor.fetchall()
        return jsonify({"success": True, "libros": libros, "count": len(libros)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/libros/<int:id_libro>/resenas', methods=['GET'])
def get_resenas_libro(id_libro):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            SELECT 
                r.id_resena,
                r.calificacion,
                r.comentario,
                r.fecha_resena,
                CONCAT(p.nombre, ' ', p.a_paterno) as usuario_nombre
            FROM resena_libro r
            JOIN usuario u ON r.id_usuario = u.id_usuario
            JOIN persona p ON u.id_persona = p.id_persona
            WHERE r.id_libro = %s
            ORDER BY r.fecha_resena DESC;
        """, (id_libro,))
        resenas = cursor.fetchall()
        return jsonify({"success": True, "resenas": resenas, "count": len(resenas)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/wishlist/agregar', methods=['POST'])
def agregar_wishlist():
    data = request.json or {}
    id_usuario = data.get('id_usuario')
    id_libro = data.get('id_libro')

    if not id_usuario or not id_libro:
        return jsonify({"success": False, "mensaje": "Usuario y libro requeridos."}), 400

    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            INSERT INTO lista_deseos (id_usuario, id_libro)
            VALUES (%s, %s)
            ON CONFLICT (id_usuario, id_libro) DO NOTHING;
        """, (id_usuario, id_libro))
        conn.commit()

        return jsonify({
            "success": True,
            "mensaje": "¡Libro agregado a tu Lista de Deseos (Quiero leer)!"
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/wishlist/<int:id_usuario>', methods=['GET'])
def get_wishlist(id_usuario):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            SELECT l.id_libro, l.titulo, l.portada_url, c.categoria, ld.fecha_agregado
            FROM lista_deseos ld
            JOIN libro l ON ld.id_libro = l.id_libro
            JOIN categoria c ON l.id_categoria = c.id_categoria
            WHERE ld.id_usuario = %s
            ORDER BY ld.fecha_agregado DESC;
        """, (id_usuario,))
        items = cursor.fetchall()
        return jsonify({"success": True, "wishlist": items, "count": len(items)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/libros/<int:id_libro>/calificar', methods=['POST'])
def calificar_libro(id_libro):
    data = request.json or {}
    calificacion = data.get('calificacion', 5)
    comentario = data.get('comentario', '').strip()
    id_usuario = data.get('id_usuario', 1)

    if not (1 <= calificacion <= 5):
        return jsonify({"success": False, "mensaje": "La calificación debe estar entre 1 y 5 estrellas."}), 400

    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            INSERT INTO resena_libro (id_usuario, id_libro, calificacion, comentario)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id_usuario, id_libro) DO UPDATE SET
                calificacion = EXCLUDED.calificacion,
                comentario = EXCLUDED.comentario,
                fecha_resena = CURRENT_TIMESTAMP;
        """, (id_usuario, id_libro, calificacion, comentario))
        conn.commit()

        cursor.execute("SELECT promedio_calificacion FROM libro WHERE id_libro = %s;", (id_libro,))
        prom = cursor.fetchone()

        return jsonify({
            "success": True,
            "mensaje": "¡Puntuación guardada con éxito!",
            "promedio_calificacion": float(prom['promedio_calificacion'])
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/auth/login', methods=['POST'])
def login_usuario():
    data = request.json or {}
    correo_login = data.get('correo', '').strip().lower()
    contrasena = data.get('contrasena', '').strip()

    if not correo_login or not contrasena:
        return jsonify({"success": False, "mensaje": "Correo y contraseña requeridos."}), 400

    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            SELECT 
                p.id_persona, p.nombre, p.a_paterno, p.a_materno, p.correo, p.correo_respaldo, p.telefono,
                u.id_usuario, u.matricula, u.puntos, u.es_deudor
            FROM persona p
            JOIN usuario u ON p.id_persona = u.id_persona
            WHERE (p.correo = %s OR p.correo_respaldo = %s) AND p.contrasena = %s;
        """, (correo_login, correo_login, contrasena))
        user = cursor.fetchone()

        if not user:
            return jsonify({"success": False, "mensaje": "Correo o contraseña incorrectos."}), 401

        return jsonify({
            "success": True,
            "mensaje": f"¡Bienvenido de nuevo, {user['nombre']}!",
            "usuario": user
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

@app.route('/api/auth/registro', methods=['POST'])
def registro_usuario():
    data = request.json or {}
    nombre = data.get('nombre', '').strip()
    a_paterno = data.get('a_paterno', '').strip()
    a_materno = data.get('a_materno', '').strip()
    correo = data.get('correo', '').strip().lower()
    correo_respaldo = data.get('correo_respaldo', '').strip().lower() or None
    telefono = data.get('telefono', '').strip()
    contrasena = data.get('contrasena', '').strip()
    matricula = data.get('matricula', '').strip()

    if not (correo.endswith('@teschi.edu.mx') or correo.endswith('@tesch.edu.mx')):
        return jsonify({"success": False, "mensaje": "El correo principal debe ser institucional (@teschi.edu.mx)."}), 400

    if len(contrasena) < 8:
        return jsonify({"success": False, "mensaje": "La contraseña debe tener al menos 8 caracteres."}), 400

    conn = get_db_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute("""
            INSERT INTO persona (nombre, a_paterno, a_materno, correo, correo_respaldo, telefono, contrasena)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id_persona;
        """, (nombre, a_paterno, a_materno, correo, correo_respaldo, telefono, contrasena))
        id_persona = cursor.fetchone()['id_persona']

        cursor.execute("""
            INSERT INTO usuario (id_persona, matricula)
            VALUES (%s, %s)
            RETURNING id_usuario, matricula, puntos;
        """, (id_persona, matricula))
        u_data = cursor.fetchone()

        conn.commit()

        user_payload = {
            "id_persona": id_persona,
            "id_usuario": u_data['id_usuario'],
            "nombre": nombre,
            "a_paterno": a_paterno,
            "correo": correo,
            "correo_respaldo": correo_respaldo,
            "matricula": matricula,
            "puntos": u_data['puntos']
        }

        return jsonify({
            "success": True, 
            "mensaje": "Registro completado exitosamente", 
            "usuario": user_payload
        })
    except psycopg2.IntegrityError as ie:
        conn.rollback()
        return jsonify({"success": False, "mensaje": "El correo o la matrícula ya se encuentran registrados."}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        release_db_connection(conn)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
